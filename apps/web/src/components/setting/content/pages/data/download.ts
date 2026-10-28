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
  const blob = new Blob([serializeBackupDocument(document)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = backupFileName(document.exportedAt);
  anchor.style.display = "none";
  globalThis.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
