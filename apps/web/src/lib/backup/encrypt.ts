import { sealBackupEnvelope } from "@/lib/crypto/envelope";
import type { BackupDocument } from "./types";

/**
 * Seal the tables of a backup document as an encrypted v2 envelope and
 * return the file text: a plaintext header (format, version, appVersion,
 * exportedAt) plus the AES-256-GCM-sealed tables object — exactly the v1
 * payload, nothing else. The passphrase is used for this call only; it is
 * never stored, logged, or written into the file name.
 */
export async function sealBackupDocument(
  document: BackupDocument,
  passphrase: string,
): Promise<string> {
  return sealBackupEnvelope(document.tables, passphrase, {
    appVersion: document.appVersion,
    exportedAt: document.exportedAt,
  });
}
