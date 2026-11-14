import {
  BACKUP_ENVELOPE_FORMAT,
  BACKUP_ENVELOPE_VERSION,
  openEnvelope,
  parseEnvelope,
  sealBackupEnvelope,
  type BackupEnvelope,
} from "@/lib/crypto/envelope";
import { parseBackupDocument } from "./apply";
import { BACKUP_FORMAT, type BackupDocument } from "./types";

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

/**
 * Thrown when decryption of a backup payload fails authentication — wrong
 * passphrase, or a bit-flipped/truncated file. The UI must not tell the
 * causes apart: it shows one ambiguous message and allows unlimited
 * in-place retry. The message is an internal English diagnostic; the UI
 * translates at the boundary.
 */
export class BackupDecryptError extends Error {
  constructor() {
    super("Wrong passphrase, or the file is damaged or incomplete.");
    this.name = "BackupDecryptError";
  }
}

/**
 * Detect an encrypted backup by the presence of its `format` identifier
 * and an encryption block. Detection reads the plaintext header only; the
 * payload stays sealed. A plain v1 file has no encryption block and is not
 * detected, so it routes to the plain restore path unchanged. A non-JSON
 * file is not a backup envelope.
 */
export function isBackupEnvelope(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const record = value as Record<string, unknown>;
    return (
      record.format === BACKUP_ENVELOPE_FORMAT &&
      typeof record.encryption === "object" &&
      record.encryption !== null &&
      !Array.isArray(record.encryption)
    );
  } catch {
    return false;
  }
}

/**
 * Validate an encrypted backup without decrypting: envelope structure, the
 * encryption block, and the payload's presence — then the version gate. A
 * backup from a newer app is rejected with the update-the-app message
 * before any passphrase is asked for. Throws an Error with an English
 * diagnostic; the UI surfaces it at the boundary.
 */
export function readBackupEnvelope(text: string): BackupEnvelope {
  const envelope = parseEnvelope(text);
  if (envelope.format !== BACKUP_ENVELOPE_FORMAT) {
    throw new Error(
      "This doesn't look like an encrypted backup — the format identifier is wrong.",
    );
  }
  if (envelope.version > BACKUP_ENVELOPE_VERSION) {
    throw new Error(
      "This backup was made by a newer version of nanoboard — update the app first, then restore.",
    );
  }
  return envelope;
}

/**
 * Open an encrypted backup with the passphrase and return the restored
 * document. Decryption happens first; on success the decrypted tables feed
 * the existing pipeline unchanged — the document is re-serialized and
 * parsed by parseBackupDocument, so structural validation, the version
 * policy, and the error messages are byte-identical to restoring a plain
 * file. Any authentication failure throws {@link BackupDecryptError} (one
 * ambiguous error, never distinguishable); a structurally invalid payload
 * throws the parser's validation Error. Either way, no database write has
 * happened at that point. The passphrase is used for this call only; it is
 * never stored, logged, or attached to any error.
 */
export async function openBackupDocument(
  text: string,
  passphrase: string,
): Promise<BackupDocument> {
  const envelope = readBackupEnvelope(text);

  let tables: unknown;
  try {
    tables = await openEnvelope(text, passphrase);
  } catch {
    throw new BackupDecryptError();
  }

  return parseBackupDocument(
    JSON.stringify({
      format: BACKUP_FORMAT,
      version: envelope.version,
      appVersion: envelope.appVersion,
      exportedAt: envelope.exportedAt,
      tables,
    }),
  );
}
