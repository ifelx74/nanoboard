import type { NanoboardDB } from "@/lib/db/db";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLES,
  type BackupDocument,
  type BackupTables,
} from "./types";

/**
 * Read every table as one consistent snapshot, so a backup never mixes rows
 * from before and after a concurrent write.
 */
async function readBackupTables(db: NanoboardDB): Promise<BackupTables> {
  const tables = {} as BackupTables;
  await db.transaction(
    "r",
    BACKUP_TABLES.map((name) => db.table(name)),
    async () => {
      for (const name of BACKUP_TABLES) {
        tables[name] = await db.table(name).toArray();
      }
    },
  );
  return tables;
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
