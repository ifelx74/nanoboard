import {
  openEnvelope,
  parseEnvelope,
  sealTaskTransferEnvelope,
  TASK_TRANSFER_ENVELOPE_FORMAT,
  TASK_TRANSFER_ENVELOPE_VERSION,
  type TaskTransferEnvelope,
} from "@/lib/crypto/envelope";
import type { TaskTransferDocument } from "./types";

/**
 * Seal the bare { project, tasks } document — exactly what the plain export
 * serializes — as an encrypted wrapper and return the file text. The
 * passphrase is used for this call only; it is never stored, logged, or
 * written into the file name.
 */
export async function sealTaskTransferDocument(
  document: TaskTransferDocument,
  passphrase: string,
): Promise<string> {
  return sealTaskTransferEnvelope(document, passphrase);
}

/**
 * Detect an encrypted task transfer by the presence of its `format`
 * identifier. Detection reads the header only; the payload stays sealed.
 * A non-JSON file or a JSON value without the identifier is not a wrapper.
 */
export function isTaskTransferEnvelope(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).format ===
        TASK_TRANSFER_ENVELOPE_FORMAT
    );
  } catch {
    return false;
  }
}

/**
 * Validate an encrypted wrapper without decrypting: header structure, the
 * encryption block, and the payload's presence — then the version gate. A
 * wrapper from a newer app is rejected with the update-the-app message
 * before any passphrase is asked for. Throws an Error with an English
 * diagnostic; the UI surfaces it at the boundary.
 */
export function readTaskTransferEnvelope(text: string): TaskTransferEnvelope {
  const envelope = parseEnvelope(text);
  if (envelope.format !== TASK_TRANSFER_ENVELOPE_FORMAT) {
    throw new Error(
      "This doesn't look like an encrypted task transfer — the format identifier is wrong.",
    );
  }
  if (envelope.version > TASK_TRANSFER_ENVELOPE_VERSION) {
    throw new Error(
      "This task transfer was created by a newer version of nanoboard — update the app first.",
    );
  }
  return envelope;
}

/**
 * Open an encrypted wrapper with the passphrase and return the bare
 * document as file text, ready for the existing parse → plan → preview →
 * import pipeline. Any authentication failure — wrong passphrase, tampered
 * or truncated ciphertext — surfaces as one ambiguous error; callers should
 * not tell the causes apart. The returned text is freshly serialized and
 * carries nothing but the bare document.
 */
export async function openTaskTransferDocument(
  text: string,
  passphrase: string,
): Promise<string> {
  readTaskTransferEnvelope(text);
  const payload = await openEnvelope(text, passphrase);
  return JSON.stringify(payload);
}
