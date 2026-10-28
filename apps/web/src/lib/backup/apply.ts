import type { NanoboardDB } from "@/lib/db/db";
import type {
  Column,
  Label,
  Project,
  Sticky,
  Task,
  TaskLabel,
  TaskResource,
  Whiteboard,
} from "@/lib/db/schema";
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  type BackupDocument,
  type BackupTableName,
} from "./types";
import { assertValidBackupDocument } from "./validate";

/**
 * Parse backup file text into a document. Rejects anything that isn't a
 * nanoboard backup — unparseable JSON, a foreign format identifier, a
 * missing/shapeless tables map, a known table that isn't an array, or a row
 * failing its structural checks — before the caller ever touches the
 * database.
 *
 * Tolerant by design in exactly two ways: a tables map missing a known table
 * reads as empty, and unknown tables are ignored, so files produced by other
 * app versions parse and their compatibility is decided by the version
 * policy, not by shape.
 */
export function parseBackupDocument(text: string): BackupDocument {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Could not read this file — it is not valid JSON.");
  }

  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  if (!record || record.format !== BACKUP_FORMAT) {
    throw new Error(
      "This doesn't look like a nanoboard backup — the format identifier is missing or wrong.",
    );
  }

  const version = record.version;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error(
      "This doesn't look like a valid nanoboard backup — no format version.",
    );
  }

  const rawTables =
    typeof record.tables === "object" &&
    record.tables !== null &&
    !Array.isArray(record.tables)
      ? (record.tables as Record<string, unknown>)
      : null;
  if (!rawTables) {
    throw new Error(
      "This doesn't look like a valid nanoboard backup — no data tables.",
    );
  }

  const document: BackupDocument = {
    format: BACKUP_FORMAT,
    version,
    appVersion: asString(record.appVersion, "unknown"),
    exportedAt: asString(record.exportedAt, new Date().toISOString()),
    tables: {
      projects: asRows<Project>("projects", rawTables),
      columns: asRows<Column>("columns", rawTables),
      tasks: asRows<Task>("tasks", rawTables),
      labels: asRows<Label>("labels", rawTables),
      taskLabels: asRows<TaskLabel>("taskLabels", rawTables),
      taskResources: asRows<TaskResource>("taskResources", rawTables),
      stickies: asRows<Sticky>("stickies", rawTables),
      whiteboards: asRows<Whiteboard>("whiteboards", rawTables),
    },
  };

  // The full structural gate sits inside the parser: a file that fails the
  // version policy or any row's structural checks never becomes a document
  // the caller could apply.
  assertValidBackupDocument(document);

  return document;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * The parser boundary: file JSON becomes trusted row shapes here. A missing
 * table reads as empty; a table present but not an array is corruption, not
 * tolerance, and aborts the parse.
 */
function asRows<Row>(
  name: BackupTableName,
  rawTables: Record<string, unknown>,
): Row[] {
  const value = rawTables[name];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(
      `This backup is corrupted — the "${name}" table is not a list of rows.`,
    );
  }
  return value as Row[];
}

/** Row counts per table, for the restore preview's "backup contains" side. */
export function backupTableCounts(
  document: BackupDocument,
): Record<BackupTableName, number> {
  const counts = {} as Record<BackupTableName, number>;
  for (const name of BACKUP_TABLES) {
    counts[name] = document.tables[name].length;
  }
  return counts;
}

/** Live row counts of the given database, keyed like backupTableCounts. */
export async function readWorkspaceCounts(
  db: NanoboardDB,
): Promise<Record<BackupTableName, number>> {
  const entries = await Promise.all(
    BACKUP_TABLES.map(async (name) => [name, await db.table(name).count()]),
  );
  return Object.fromEntries(entries) as Record<BackupTableName, number>;
}

/**
 * Replace the entire database with the backup's contents: every table wiped
 * and re-inserted inside one transaction. A failure anywhere — a store-level
 * constraint on any row, a closed connection — aborts the whole transaction,
 * so the database is left exactly as it was. The caller decides when the UI
 * reflects the new state; for a full restore that is a page reload.
 *
 * The document is re-validated here rather than trusting the caller to have
 * parsed a file first: the all-or-nothing guarantee must hold for every call
 * site, not just the one that goes through `parseBackupDocument`.
 */
export async function applyBackupDocument(
  db: NanoboardDB,
  document: BackupDocument,
): Promise<void> {
  assertValidBackupDocument(document);
  await db.transaction(
    "rw",
    BACKUP_TABLES.map((name) => db.table(name)),
    async () => {
      for (const name of BACKUP_TABLES) {
        await db.table(name).clear();
      }
      for (const name of BACKUP_TABLES) {
        await db.table(name).bulkAdd(document.tables[name]);
      }
    },
  );
}
