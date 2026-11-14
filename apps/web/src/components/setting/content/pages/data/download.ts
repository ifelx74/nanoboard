import { triggerDownload } from "@/lib/download";
import { serializeBackupDocument } from "@/lib/backup/serialize";
import type { BackupDocument } from "@/lib/backup/types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * `nanoboard-backup-<yyyy-mm-dd>T<hh-mm>.json` — date and time, local,
 * zero-padded, no colons — so repeated backups never overwrite each other.
 */
export function backupFileName(exportedAt: string): string {
  const at = new Date(exportedAt);
  return `nanoboard-backup-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(
    at.getDate(),
  )}T${pad(at.getHours())}-${pad(at.getMinutes())}.json`;
}

export function downloadBackupDocument(document: BackupDocument): void {
  triggerDownload(
    serializeBackupDocument(document),
    backupFileName(document.exportedAt),
  );
}

/**
 * Download an already-serialized backup as the same kind of file the v1
 * export produced — extension and naming unchanged. Used by the encrypted
 * path, whose file text comes from the seal step, not the serializer.
 */
export function downloadBackupText(text: string, exportedAt: string): void {
  triggerDownload(text, backupFileName(exportedAt));
}
