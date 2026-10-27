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
  BACKUP_FORMAT_VERSION,
  type BackupDocument,
  type BackupTables,
} from "./types";

/**
 * Parse backup file text into a document. Rejects anything that isn't a
 * nanoboard backup — unparseable JSON, a foreign format identifier, or a
 * missing/shapeless tables map — before the caller ever touches the database.
 *
 * Tolerant by design: a tables map missing a known table reads as empty, and
 * unknown tables are ignored, so files produced by other app versions parse
 * and their compatibility is decided by the version policy, not by shape.
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
  if (typeof version !== "number") {
    throw new Error(
      "This doesn't look like a valid nanoboard backup — no format version.",
    );
  }

  const rawTables =
    typeof record.tables === "object" && record.tables !== null
      ? (record.tables as Record<string, unknown>)
      : null;
  if (!rawTables) {
    throw new Error(
      "This doesn't look like a valid nanoboard backup — no data tables.",
    );
  }

  return {
    format: BACKUP_FORMAT,
    version: version as typeof BACKUP_FORMAT_VERSION,
    appVersion: asString(record.appVersion, "unknown"),
    exportedAt: asString(record.exportedAt, new Date().toISOString()),
    tables: {
      projects: asRows<Project>(rawTables.projects),
      columns: asRows<Column>(rawTables.columns),
      tasks: asRows<Task>(rawTables.tasks),
      labels: asRows<Label>(rawTables.labels),
      taskLabels: asRows<TaskLabel>(rawTables.taskLabels),
      taskResources: asRows<TaskResource>(rawTables.taskResources),
      stickies: asRows<Sticky>(rawTables.stickies),
      whiteboards: asRows<Whiteboard>(rawTables.whiteboards),
    },
  };
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/** The parser boundary: file JSON becomes trusted row shapes here, or []. */
function asRows<Row>(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

/** Row counts per table, for the restore preview's "backup contains" side. */
export function backupTableCounts(
  document: BackupDocument,
): Record<keyof BackupTables, number> {
  return {
    projects: document.tables.projects.length,
    columns: document.tables.columns.length,
    tasks: document.tables.tasks.length,
    labels: document.tables.labels.length,
    taskLabels: document.tables.taskLabels.length,
    taskResources: document.tables.taskResources.length,
    stickies: document.tables.stickies.length,
    whiteboards: document.tables.whiteboards.length,
  };
}

const BACKUP_TABLE_KEYS = [
  "projects",
  "columns",
  "tasks",
  "labels",
  "taskLabels",
  "taskResources",
  "stickies",
  "whiteboards",
] as const;

/**
 * Replace the entire database with the backup's contents: every table wiped
 * and re-inserted inside one transaction. A failure anywhere — a store-level
 * constraint on any row, a closed connection — aborts the whole transaction,
 * so the database is left exactly as it was. The caller decides when the UI
 * reflects the new state; for a full restore that is a page reload.
 */
export async function applyBackupDocument(
  db: NanoboardDB,
  document: BackupDocument,
): Promise<void> {
  await db.transaction(
    "rw",
    BACKUP_TABLE_KEYS.map((name) => db[name]),
    async () => {
      await db.projects.clear();
      await db.columns.clear();
      await db.tasks.clear();
      await db.labels.clear();
      await db.taskLabels.clear();
      await db.taskResources.clear();
      await db.stickies.clear();
      await db.whiteboards.clear();

      await db.projects.bulkAdd(document.tables.projects);
      await db.columns.bulkAdd(document.tables.columns);
      await db.tasks.bulkAdd(document.tables.tasks);
      await db.labels.bulkAdd(document.tables.labels);
      await db.taskLabels.bulkAdd(document.tables.taskLabels);
      await db.taskResources.bulkAdd(document.tables.taskResources);
      await db.stickies.bulkAdd(document.tables.stickies);
      await db.whiteboards.bulkAdd(document.tables.whiteboards);
    },
  );
}
