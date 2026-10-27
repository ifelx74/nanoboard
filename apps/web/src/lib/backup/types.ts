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

/** Self-describing format identifier carried by every backup file. */
export const BACKUP_FORMAT = "nanoboard-backup";

/** Current backup format version; bumped only alongside a migration contract. */
export const BACKUP_FORMAT_VERSION = 1;

/**
 * The exact table set a v1 backup carries: the envelope's `tables` map keys,
 * in schema order so serialized files diff cleanly.
 */
export const BACKUP_TABLES = [
  "projects",
  "columns",
  "tasks",
  "labels",
  "taskLabels",
  "taskResources",
  "stickies",
  "whiteboards",
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

/** Raw rows of every table, exactly as stored. */
export interface BackupTables {
  projects: Project[];
  columns: Column[];
  tasks: Task[];
  labels: Label[];
  taskLabels: TaskLabel[];
  taskResources: TaskResource[];
  stickies: Sticky[];
  whiteboards: Whiteboard[];
}

/**
 * The version-1 whole-workspace backup envelope. Raw rows only — IDs,
 * positions, task numbers, timestamps, branded strings, and the Excalidraw
 * scene triples are preserved verbatim, so a restore can reproduce the app
 * and a future folder-sync can diff the file.
 */
export interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_FORMAT_VERSION;
  /** The exporting app's own version (package.json), inlined at build time. */
  appVersion: string;
  /** ISO timestamp of the export. */
  exportedAt: string;
  tables: BackupTables;
}
