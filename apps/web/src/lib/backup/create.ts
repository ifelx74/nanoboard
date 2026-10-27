import type { NanoboardDB } from "@/lib/db/db";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupDocument,
  type BackupTables,
} from "./types";

const ALL_BACKUP_TABLES = [
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
 * Read every table as one consistent snapshot, so a backup never mixes rows
 * from before and after a concurrent write.
 */
async function readBackupTables(db: NanoboardDB): Promise<BackupTables> {
  return db.transaction(
    "r",
    ALL_BACKUP_TABLES.map((name) => db[name]),
    async () => ({
      projects: await db.projects.toArray(),
      columns: await db.columns.toArray(),
      tasks: await db.tasks.toArray(),
      labels: await db.labels.toArray(),
      taskLabels: await db.taskLabels.toArray(),
      taskResources: await db.taskResources.toArray(),
      stickies: await db.stickies.toArray(),
      whiteboards: await db.whiteboards.toArray(),
    }),
  );
}

/**
 * Create the v1 whole-workspace backup envelope from the given database:
 * header fields plus the raw rows of every table. Counts for export feedback
 * come from the returned document itself.
 */
export async function createBackupDocument(
  db: NanoboardDB,
): Promise<BackupDocument> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    appVersion: __APP_VERSION__,
    exportedAt: new Date().toISOString(),
    tables: await readBackupTables(db),
  };
}
