/**
 * Shared envelope encryption for nanoboard's file formats. Both exporters
 * (whole-workspace backup v2 and the per-project task transfer) seal their
 * JSON payload object under a user passphrase with AES-256-GCM and a
 * PBKDF2-HMAC-SHA-256 key derived per file. The header — format, version,
 * backup-only appVersion/exportedAt, and the encryption block — stays
 * plaintext so the UI can validate and identify the file before the user
 * enters the passphrase; the payload is sealed and the header is bound
 * to the ciphertext as AES-GCM's additional authenticated data, so the
 * header can be displayed but not rewritten. PBKDF2 parameters are
 * recorded in the envelope so future parameter bumps don't lock out old
 * files. No passphrase verifier: GCM authentication alone distinguishes
 * right from wrong keys.
 */

export const BACKUP_ENVELOPE_FORMAT = "nanoboard-backup";
export const BACKUP_ENVELOPE_VERSION = 2;
export const TASK_TRANSFER_ENVELOPE_FORMAT = "nanoboard-task-transfer";
export const TASK_TRANSFER_ENVELOPE_VERSION = 1;

const PBKDF2_ITERATIONS = 600_000;
/**
 * Accepted range for the KDF iteration count recorded in an envelope. The
 * floor blocks a crafted file from smuggling a near-zero-cost KDF past the
 * "corrupted file" gate; the ceiling blocks a file that pins the CPU for an
 * absurd stretch before the first GCM check. Ten times the seal value leaves
 * headroom for future parameter bumps. Files nanoboard writes always land
 * inside this band.
 */
const MIN_KDF_ITERATIONS = 100_000;
const MAX_KDF_ITERATIONS = PBKDF2_ITERATIONS * 10;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptionBlock {
  algorithm: "AES-256-GCM";
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  iv: string;
}

/**
 * The header metadata is optional: a hand-made or foreign-tool v2 file may
 * omit either field, and restoring it must still work. Readers render what
 * is present and omit what is not.
 */
export interface BackupEnvelope {
  format: typeof BACKUP_ENVELOPE_FORMAT;
  version: number;
  appVersion?: string;
  exportedAt?: string;
  encryption: EncryptionBlock;
  payload: string;
}

export interface TaskTransferEnvelope {
  format: typeof TASK_TRANSFER_ENVELOPE_FORMAT;
  version: number;
  encryption: EncryptionBlock;
  payload: string;
}

export type Envelope = BackupEnvelope | TaskTransferEnvelope;

/**
 * The plaintext header — format, version, and the backup-only metadata —
 * is bound to the ciphertext as AES-GCM's additional authenticated data.
 * Without it, an attacker with write access to the file could rewrite the
 * metadata the unlock step displays (or the version the gate uses) and the
 * GCM tag would still verify. Key order in the AAD is fixed by construction;
 * both the seal and open paths build it through this one function.
 *
 * Note: envelopes sealed before AAD was introduced can no longer be opened
 * — they fail GCM verification and surface as the ambiguous error.
 */
function headerAdditionalData(
  fields: Record<string, string | number>,
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(fields));
}

function backupHeaderFields(
  format: string,
  version: number,
  appVersion?: string,
  exportedAt?: string,
): Record<string, string | number> {
  const fields: Record<string, string | number> = { format, version };
  if (appVersion !== undefined) fields.appVersion = appVersion;
  if (exportedAt !== undefined) fields.exportedAt = exportedAt;
  return fields;
}

function envelopeAdditionalData(envelope: Envelope): Uint8Array {
  if (envelope.format === BACKUP_ENVELOPE_FORMAT) {
    return headerAdditionalData(
      backupHeaderFields(
        envelope.format,
        envelope.version,
        envelope.appVersion,
        envelope.exportedAt,
      ),
    );
  }
  return headerAdditionalData({
    format: envelope.format,
    version: envelope.version,
  });
}

export interface BackupEnvelopeHeader {
  appVersion: string;
  exportedAt: string;
}

/**
 * Seal a JSON-serializable payload as a backup v2 envelope and return the
 * minified envelope JSON. The header fields are written verbatim; the
 * caller owns their provenance.
 */
export async function sealBackupEnvelope(
  payload: unknown,
  passphrase: string,
  header: BackupEnvelopeHeader,
): Promise<string> {
  const additionalData = headerAdditionalData(
    backupHeaderFields(
      BACKUP_ENVELOPE_FORMAT,
      BACKUP_ENVELOPE_VERSION,
      header.appVersion,
      header.exportedAt,
    ),
  );
  const { encryption, ciphertext } = await sealPayload(
    payload,
    passphrase,
    additionalData,
  );
  const envelope: BackupEnvelope = {
    format: BACKUP_ENVELOPE_FORMAT,
    version: BACKUP_ENVELOPE_VERSION,
    appVersion: header.appVersion,
    exportedAt: header.exportedAt,
    encryption,
    payload: ciphertext,
  };
  return JSON.stringify(envelope);
}

/**
 * Seal a JSON-serializable payload as a task-transfer wrapper envelope and
 * return the minified envelope JSON. The wrapper carries no header metadata.
 */
export async function sealTaskTransferEnvelope(
  payload: unknown,
  passphrase: string,
): Promise<string> {
  const { encryption, ciphertext } = await sealPayload(
    payload,
    passphrase,
    headerAdditionalData({
      format: TASK_TRANSFER_ENVELOPE_FORMAT,
      version: TASK_TRANSFER_ENVELOPE_VERSION,
    }),
  );
  const envelope: TaskTransferEnvelope = {
    format: TASK_TRANSFER_ENVELOPE_FORMAT,
    version: TASK_TRANSFER_ENVELOPE_VERSION,
    encryption,
    payload: ciphertext,
  };
  return JSON.stringify(envelope);
}

/**
 * Parse envelope file text into its typed shape without decrypting. Used
 * before the passphrase is known: to detect an envelope at all, to validate
 * the plaintext header, and to read the metadata the unlock step displays.
 * The payload's base64 is decoded once (validating its charset and minimum
 * length); the bytes are discarded — decrypting callers should pass this
 * envelope to {@link decryptEnvelope} rather than re-parsing the text.
 */
export function parseEnvelope(text: string): Envelope {
  const envelope = parseEnvelopeParts(text);
  decodePayloadChecked(envelope.payload);
  return envelope;
}

/**
 * Everything {@link parseEnvelope} validates except the payload's bytes —
 * JSON, envelope shape, format/version, and the encryption block. Split out
 * so callers that already hold a validated envelope can decrypt it with
 * {@link decryptEnvelope} without re-parsing the file text.
 */
function parseEnvelopeParts(text: string): Envelope {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Could not read this file — it is not valid JSON.");
  }

  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  if (!record) {
    throw new Error(
      "This doesn't look like an encrypted nanoboard file — the envelope is missing.",
    );
  }

  const format = record.format;
  if (
    format !== BACKUP_ENVELOPE_FORMAT &&
    format !== TASK_TRANSFER_ENVELOPE_FORMAT
  ) {
    throw new Error(
      "This doesn't look like an encrypted nanoboard file — the format identifier is missing or wrong.",
    );
  }

  const version = record.version;
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new Error(
      "This doesn't look like a valid encrypted nanoboard file — no format version.",
    );
  }

  const encryption = parseEncryptionBlock(record.encryption);

  const payload = record.payload;
  if (typeof payload !== "string" || payload.length === 0) {
    throw new Error(
      "This encrypted nanoboard file is corrupted — the payload is missing.",
    );
  }

  if (format === BACKUP_ENVELOPE_FORMAT) {
    const envelope: BackupEnvelope = { format, version, encryption, payload };
    if (typeof record.appVersion === "string") {
      envelope.appVersion = record.appVersion;
    }
    if (typeof record.exportedAt === "string") {
      envelope.exportedAt = record.exportedAt;
    }
    return envelope;
  }
  return { format, version, encryption, payload };
}

/**
 * Decode a payload's base64 once, validating the charset (invalid base64
 * throws) and the minimum length — GCM ciphertext is at least the 16-byte
 * tag, so anything shorter can never authenticate.
 */
function decodePayloadChecked(payload: string): Uint8Array {
  const bytes = base64ToBytes(payload);
  if (bytes.length < 16) {
    throw new Error(
      "This encrypted nanoboard file is corrupted — the payload is truncated.",
    );
  }
  return bytes;
}

/**
 * Open an envelope file with the passphrase and return the decrypted
 * payload object. Any authentication failure — wrong passphrase,
 * bit-flipped or truncated ciphertext — surfaces as one ambiguous error;
 * callers should not try to tell the causes apart.
 */
export async function openEnvelope(
  text: string,
  passphrase: string,
): Promise<unknown> {
  return decryptEnvelope(parseEnvelopeParts(text), passphrase);
}

/**
 * Decrypt an already-parsed envelope with the passphrase — the decrypt
 * half of {@link openEnvelope}, split out so a caller that already
 * validated the envelope (e.g. {@link parseEnvelope} for the pre-passphrase
 * header check) doesn't pay a second JSON.parse and shape validation.
 * The plaintext header is bound as the GCM additional authenticated
 * data. Any failure — bad payload encoding, GCM
 * authentication, or non-JSON plaintext — surfaces as one ambiguous error;
 * callers should not try to tell the causes apart.
 */
export async function decryptEnvelope(
  envelope: Envelope,
  passphrase: string,
): Promise<unknown> {
  const { kdf } = envelope.encryption;
  const payload = decodePayloadChecked(envelope.payload);

  const salt = base64ToBytes(kdf.salt);
  const iv = base64ToBytes(envelope.encryption.iv);
  const key = await deriveKey(passphrase, salt, kdf.iterations);
  const additionalData = envelopeAdditionalData(envelope);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toBufferSource(iv),
        additionalData: toBufferSource(additionalData),
      },
      key,
      toBufferSource(payload),
    );
  } catch {
    throw new Error("Wrong passphrase, or the file is damaged or incomplete.");
  }

  try {
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Wrong passphrase, or the file is damaged or incomplete.");
  }
}

async function sealPayload(
  payload: unknown,
  passphrase: string,
  additionalData: Uint8Array,
): Promise<{ encryption: EncryptionBlock; ciphertext: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toBufferSource(iv),
      additionalData: toBufferSource(additionalData),
    },
    key,
    toBufferSource(plaintext),
  );

  return {
    encryption: {
      algorithm: "AES-256-GCM",
      kdf: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt),
      },
      iv: bytesToBase64(iv),
    },
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: toBufferSource(salt), iterations },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function parseEncryptionBlock(value: unknown): EncryptionBlock {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  if (!record || record.algorithm !== "AES-256-GCM") {
    throw new Error(
      "This encrypted nanoboard file is corrupted — unknown encryption algorithm.",
    );
  }

  const kdf =
    typeof record.kdf === "object" && record.kdf !== null
      ? (record.kdf as Record<string, unknown>)
      : null;
  if (
    !kdf ||
    kdf.name !== "PBKDF2" ||
    kdf.hash !== "SHA-256" ||
    typeof kdf.iterations !== "number" ||
    !Number.isInteger(kdf.iterations) ||
    kdf.iterations < MIN_KDF_ITERATIONS ||
    kdf.iterations > MAX_KDF_ITERATIONS ||
    typeof kdf.salt !== "string"
  ) {
    throw new Error(
      "This encrypted nanoboard file is corrupted — the KDF parameters are missing or wrong.",
    );
  }

  const salt = base64ToBytes(kdf.salt);
  if (salt.length !== SALT_BYTES) {
    throw new Error(
      "This encrypted nanoboard file is corrupted — the KDF salt is wrong.",
    );
  }

  if (typeof record.iv !== "string") {
    throw new Error(
      "This encrypted nanoboard file is corrupted — the IV is missing.",
    );
  }
  const iv = base64ToBytes(record.iv);
  if (iv.length !== IV_BYTES) {
    throw new Error(
      "This encrypted nanoboard file is corrupted — the IV is wrong.",
    );
  }

  return {
    algorithm: "AES-256-GCM",
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: kdf.iterations,
      salt: kdf.salt,
    },
    iv: record.iv,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error(
      "This encrypted nanoboard file is corrupted — invalid base64 data.",
    );
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

// WebCrypto's BufferSource typing doesn't accept Uint8Array<ArrayBufferLike>
// from every TS lib configuration; re-wrap as a fresh ArrayBuffer-backed view.
function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}
