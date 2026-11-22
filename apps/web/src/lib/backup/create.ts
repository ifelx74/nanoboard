import { blobToDataUrl } from "@/lib/data-url";
import type { NanoboardDB } from "@/lib/db/db";
import type { PageAsset } from "@/lib/db/schema";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLES,
  type BackupDocument,
  type BackupPageAsset,
  type BackupTables,
} from "./types";

/**
 * Read every table as one consistent snapshot, so a backup never mixes rows
 * from before and after a concurrent write.
 *
 * `pageAssets` rows hold binary `Blob`s in IndexedDB. We read the raw rows
 * inside the `"r"` transaction and convert each `Blob` to a base64 `dataUrl`
 * *after* the transaction closes so non-IDB async ticks (`Blob.arrayBuffer()`)
 * never trigger IndexedDB transaction auto-commit.
 */
async function readBackupTables(db: NanoboardDB): Promise<BackupTables> {
  const tables = {} as BackupTables;
  let rawPageAssets: PageAsset[] = [];

  await db.transaction(
    "r",
    BACKUP_TABLES.map((name) => db.table(name)),
    async () => {
      for (const name of BACKUP_TABLES) {
        if (name === "pageAssets") {
          rawPageAssets = await db.pageAssets.toArray();
          tables.pageAssets = [];
        } else {
          (tables as unknown as Record<string, unknown[]>)[name] = await db
            .table(name)
            .toArray();
        }
      }
    },
  );

  if (rawPageAssets.length > 0) {
    const serializedAssets: BackupPageAsset[] = [];
    for (const asset of rawPageAssets) {
      const { blob, ...rest } = asset;
      const dataUrl = await blobToDataUrl(blob, asset.mimeType);
      serializedAssets.push({ ...rest, dataUrl });
    }
    tables.pageAssets = serializedAssets;
  }

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
