import type {
  Column,
  Label,
  Project,
  Sticky,
  Task,
  TaskLabel,
  TaskResource,
  Whiteboard,
  WhiteboardPreview,
} from "@/lib/db/schema";

/** Self-describing format identifier carried by every backup file. */
export const BACKUP_FORMAT = "nanoboard-backup";

/** Current plain-file backup format version; bumped only alongside a migration contract. The "save unencrypted" export path writes this version, forever. */
export const BACKUP_FORMAT_VERSION = 1;

/**
 * The newest backup format version this app can restore. v1 is the plain
 * file above; v2 is the encrypted envelope (an always-sealed file whose
 * payload is the same tables object — see src/lib/crypto/envelope.ts). The
 * restore gate accepts every version at or below this one and rejects newer
 * files with the update-the-app message. Bumped alongside every format
 * bump; the plain writer stays at {@link BACKUP_FORMAT_VERSION}.
 */
export const BACKUP_MAX_RESTORABLE_VERSION = 2;

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
  "whiteboardPreviews",
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
  whiteboardPreviews: WhiteboardPreview[];
}

/**
 * The version-1 whole-workspace backup envelope. Raw rows only — IDs,
 * positions, task numbers, timestamps, branded strings, and the Excalidraw
 * scene triples are preserved verbatim, so a restore can reproduce the app
 * and a future folder-sync can diff the file.
 */
export interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  /**
   * The format version of the producing app. May be older than the current
   * version: the compatibility policy accepts every version at or below
   * {@link BACKUP_MAX_RESTORABLE_VERSION} and rejects newer ones. The plain
   * writer always stamps {@link BACKUP_FORMAT_VERSION}; an encrypted restore
   * carries the envelope's version (2), announced by the file itself.
   */
  version: number;
  /** The exporting app's own version (package.json), inlined at build time. */
  appVersion: string;
  /** ISO timestamp of the export. */
  exportedAt: string;
  tables: BackupTables;
}
