const BASE64_CHUNK_SIZE = 0x8000;

const BASE64_DATA_URL_PATTERN =
  /^data:([a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+(?:;[a-zA-Z0-9!#$&^_.+-]+=[^;,]+)*);base64,([A-Za-z0-9+/]*={0,2})$/;

function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}

function parseBase64DataUrl(
  value: string,
): { mimeType: string; base64: string } | null {
  const match = BASE64_DATA_URL_PATTERN.exec(value);
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2];
  if (mimeType === undefined || base64 === undefined) return null;
  if (base64.length % 4 !== 0) return null;
  return { mimeType, base64 };
}

/**
 * Returns true if `value` is a syntactically valid `data:<mime>;base64,<data>`
 * string with a well-formed MIME type and padded base64 payload.
 */
export function isValidBase64DataUrl(value: unknown): value is string {
  return typeof value === "string" && parseBase64DataUrl(value) !== null;
}

/**
 * Returns true if `value` is a valid `data:<mime>;base64,<data>` URL whose
 * exact `<mime>` token (with no parameters) is present in `allowedMimeTypes`
 * and matches `expectedMimeType` when supplied.
 */
export function isValidBase64DataUrlWithMime(
  value: unknown,
  allowedMimeTypes: readonly string[],
  expectedMimeType?: string,
): value is string {
  if (typeof value !== "string") return false;
  const parsed = parseBase64DataUrl(value);
  if (!parsed) return false;
  if (!allowedMimeTypes.includes(parsed.mimeType)) return false;
  if (expectedMimeType !== undefined && parsed.mimeType !== expectedMimeType) {
    return false;
  }
  return true;
}

/**
 * Converts a binary `Blob` to a `data:<mime>;base64,...` URL using Web-standard
 * `Blob.arrayBuffer()` + `btoa()` so it works identically in browsers and plain
 * Node test environments.
 */
export async function blobToDataUrl(
  blob: Blob,
  mimeTypeFallback?: string,
): Promise<string> {
  const mimeType =
    blob.type.trim() || mimeTypeFallback?.trim() || "application/octet-stream";
  const buffer = await blob.arrayBuffer();
  const base64 = bytesToBase64(new Uint8Array(buffer));
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Decodes a `data:<mime>;base64,...` URL synchronously into a `Blob`. Throws
 * on malformed inputs so callers can reject corrupt data before touching DB.
 */
export function dataUrlToBlob(
  dataUrl: string,
  mimeTypeFallback?: string,
): Blob {
  const parsed = parseBase64DataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Invalid base64 data URL.");
  }

  let binary: string;
  try {
    binary = globalThis.atob(parsed.base64);
  } catch {
    throw new Error("Invalid base64 data URL.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const mimeType =
    parsed.mimeType || mimeTypeFallback?.trim() || "application/octet-stream";
  return new Blob([bytes], { type: mimeType });
}
