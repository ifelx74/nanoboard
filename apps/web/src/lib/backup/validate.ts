import { STICKY_COLORS, TASK_PRIORITIES } from "@/lib/db/schema";
import type { BackupDocument, BackupTableName, BackupTables } from "./types";
import { BACKUP_FORMAT_VERSION } from "./types";

type Check = (value: unknown) => boolean;

const isString: Check = (value) => typeof value === "string";
const isNumber: Check = (value) =>
  typeof value === "number" && Number.isFinite(value);
const isBoolean: Check = (value) => typeof value === "boolean";
const isObject: Check = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isArray: Check = Array.isArray;

const isStringArray =
  (values: readonly string[]): Check =>
  (value) =>
    typeof value === "string" && values.includes(value);

interface FieldSpec {
  field: string;
  check: Check;
  optional?: boolean;
}

function spec(field: string, check: Check, optional = false): FieldSpec {
  return optional ? { field, check, optional } : { field, check };
}

/**
 * Structural row validation, table by table: field presence and primitive
 * types only — the boundary against a corrupted or hand-mangled file.
 * Deliberately NOT checked: cross-row invariants (position ordering,
 * task-number continuity, referenced IDs existing, compound-key shape
 * beyond the two string fields) and anything deep inside Excalidraw scenes.
 * The file was written by this app; structure is what corruption breaks.
 *
 * Enum fields (task priority, sticky color) are checked against their
 * current value sets. This is part of the version contract, not a semantic
 * check: a value outside the set cannot have been written by any build of
 * the same format version, so it is corruption — and rendering an unknown
 * value would fail worse than rejecting the file. Adding a value to either
 * set therefore requires a backup format version bump.
 */
const TABLE_FIELD_SPECS: Record<BackupTableName, FieldSpec[]> = {
  projects: [
    spec("id", isString),
    spec("name", isString),
    spec("slug", isString),
    spec("icon", isString),
    spec("position", isNumber),
    spec("lastTaskNumber", isNumber),
    spec("description", isString, true),
    spec("createdAt", isNumber),
    spec("updatedAt", isNumber),
  ],
  columns: [
    spec("id", isString),
    spec("projectId", isString),
    spec("name", isString),
    spec("slug", isString),
    spec("position", isNumber),
    spec("isFinal", isBoolean),
    spec("createdAt", isNumber),
    spec("updatedAt", isNumber),
  ],
  tasks: [
    spec("id", isString),
    spec("projectId", isString),
    spec("columnId", isString),
    spec("status", isString),
    spec("title", isString),
    spec("description", isString),
    spec("position", isNumber),
    spec("number", isNumber),
    spec("priority", isStringArray(TASK_PRIORITIES)),
    spec("startDate", isString, true),
    spec("dueDate", isString, true),
    spec("createdAt", isNumber),
    spec("updatedAt", isNumber),
  ],
  labels: [
    spec("id", isString),
    spec("projectId", isString),
    spec("name", isString),
    spec("color", isString),
    spec("createdAt", isNumber),
    spec("updatedAt", isNumber),
  ],
  taskLabels: [spec("taskId", isString), spec("labelId", isString)],
  taskResources: [
    spec("id", isString),
    spec("taskId", isString),
    spec("resourceType", isString),
    spec("externalId", isString),
    spec("url", isString),
    spec("title", (value) => value === null || isString(value)),
    spec("createdAt", isNumber),
    spec("updatedAt", isNumber),
  ],
  stickies: [
    spec("id", isString),
    spec("contentHtml", isString),
    spec("backgroundColor", isStringArray(STICKY_COLORS)),
    spec("position", isNumber),
    spec("createdAt", isNumber),
    spec("updatedAt", isNumber),
  ],
  whiteboards: [
    spec("id", isString),
    spec("projectId", isString),
    spec("elements", isArray),
    spec("appState", isObject),
    spec("files", isObject),
    spec("createdAt", isNumber),
    spec("updatedAt", isNumber),
  ],
};

/**
 * Reject a document whose format version is newer than this app speaks.
 * Older versions are accepted — their missing tables read as empty and their
 * older row shapes must still pass today's structural checks, which is the
 * migration contract: a version bump here is only allowed alongside a
 * validator that still accepts every older version's rows.
 */
export function assertSupportedBackupVersion(document: {
  version: number;
}): void {
  if (document.version > BACKUP_FORMAT_VERSION) {
    throw new Error(
      "This backup was made by a newer version of nanoboard — update the app first, then restore.",
    );
  }
}

/**
 * Throw if any row in the document fails its table's structural checks.
 * Runs before any database write, so a corrupt file can never reach the
 * restore transaction.
 */
export function assertValidBackupTables(tables: BackupTables): void {
  for (const [tableName, fields] of Object.entries(TABLE_FIELD_SPECS) as [
    BackupTableName,
    FieldSpec[],
  ][]) {
    const rows = tables[tableName] as unknown[];
    rows.forEach((row, index) => {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        throw new Error(
          `This backup is corrupted — table "${tableName}", row ${index + 1} is not a valid row.`,
        );
      }
      const record = row as Record<string, unknown>;
      for (const { field, check, optional } of fields) {
        const value = record[field];
        if (optional && value === undefined) continue;
        if (!check(value)) {
          throw new Error(
            `This backup is corrupted — table "${tableName}", row ${index + 1} has an invalid "${field}" field.`,
          );
        }
      }
    });
  }
}

/**
 * Full structural gate for a parsed document: version policy first (a newer
 * file must be rejected regardless of its contents), then row structure.
 */
export function assertValidBackupDocument(document: BackupDocument): void {
  assertSupportedBackupVersion(document);
  assertValidBackupTables(document.tables);
}
