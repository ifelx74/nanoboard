export const PAGE_IMAGE_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type PageImageMimeType = (typeof PAGE_IMAGE_ACCEPTED_MIME_TYPES)[number];

export const PAGE_IMAGE_ACCEPT_ATTRIBUTE =
  PAGE_IMAGE_ACCEPTED_MIME_TYPES.join(",");

/** Hard upload limit matching Plane's 10 MB per-image ceiling. */
export const PAGE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Maximum pixel length on the longest edge for compressed raster uploads. */
export const PAGE_IMAGE_MAX_DIMENSION = 1920;

/** Target quality for client-side WebP / JPEG re-encoding. */
export const PAGE_IMAGE_COMPRESSION_QUALITY = 0.82;

const ACCEPTED_MIME_SET = new Set<string>(PAGE_IMAGE_ACCEPTED_MIME_TYPES);

export type PageImageValidationErrorCode =
  "unsupported-type" | "file-too-large" | "empty-file";

export type PageImageValidationResult =
  | { ok: true; mimeType: PageImageMimeType }
  | { ok: false; code: PageImageValidationErrorCode };

export class PageImageValidationError extends Error {
  readonly code: PageImageValidationErrorCode;

  constructor(code: PageImageValidationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PageImageValidationError";
    this.code = code;
  }
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.trim().toLowerCase();
}

export function isSupportedPageImageMimeType(
  mimeType: string,
): mimeType is PageImageMimeType {
  return ACCEPTED_MIME_SET.has(normalizeMimeType(mimeType));
}

/**
 * Pure MIME whitelist and 10 MB size-cap validator for local Page image
 * uploads. Safe to run in plain Node tests and before IndexedDB persistence.
 */
export function validatePageImageUpload(file: {
  type: string;
  size: number;
}): PageImageValidationResult {
  const normalized = normalizeMimeType(file.type);
  if (!ACCEPTED_MIME_SET.has(normalized)) {
    return { ok: false, code: "unsupported-type" };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, code: "empty-file" };
  }
  if (file.size > PAGE_IMAGE_MAX_BYTES) {
    return { ok: false, code: "file-too-large" };
  }
  return { ok: true, mimeType: normalized as PageImageMimeType };
}

function isValidHttpHostname(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost") return true;
  if (hostname.startsWith(".") || hostname.endsWith(".")) return false;
  return hostname.includes(".");
}

function hasControlOrWhitespace(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validates an external image URL, allowing only explicit `http:` or `https:`
 * URLs with valid hostnames and no embedded whitespace or control characters.
 * Returns the trimmed URL on success, or `null` if invalid/unsafe.
 */
export function validateExternalImageUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || hasControlOrWhitespace(trimmed)) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!isValidHttpHostname(parsed.hostname)) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export interface TargetImageDimensions {
  width: number;
  height: number;
  resized: boolean;
}

/**
 * Computes proportional target dimensions bounded by `maxDimension` on the
 * longest edge. Dimensions already within the cap are preserved unchanged.
 */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxDimension = PAGE_IMAGE_MAX_DIMENSION,
): TargetImageDimensions {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const longestEdge = Math.max(safeWidth, safeHeight);
  if (longestEdge <= maxDimension) {
    return { width: safeWidth, height: safeHeight, resized: false };
  }
  const scale = maxDimension / longestEdge;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    resized: true,
  };
}

const MIME_TO_EXTENSION: Record<PageImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Produces a clean filename whose extension matches `mimeType`, swapping the
 * extension when client-side compression converts e.g. PNG → WebP.
 */
export function deriveAssetFileName(
  rawName: string | undefined,
  mimeType: PageImageMimeType,
): string {
  const ext = MIME_TO_EXTENSION[mimeType];
  const trimmed = (rawName ?? "").trim();
  if (!trimmed) {
    return `image.${ext}`;
  }
  const withoutTrailingDots = trimmed.replace(/\.+$/, "");
  if (!withoutTrailingDots) {
    return `image.${ext}`;
  }
  const lastDot = withoutTrailingDots.lastIndexOf(".");
  if (lastDot > 0) {
    const base = withoutTrailingDots.slice(0, lastDot);
    return `${base}.${ext}`;
  }
  return `${withoutTrailingDots}.${ext}`;
}

/**
 * Extracts a display/download filename from an external image URL, falling
 * back to `"image"` when the path has no usable segment.
 */
export function deriveExternalImageFileName(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) return "image";
    const decoded = decodeURIComponent(lastSegment).trim();
    return decoded || "image";
  } catch {
    return "image";
  }
}

export interface RasterTranscodeOptions {
  maxDimension: number;
  quality: number;
}

export interface RasterTranscodeResult {
  blob: Blob;
  mimeType: PageImageMimeType;
  width: number;
  height: number;
}

export type RasterTranscoder = (
  blob: Blob,
  options: RasterTranscodeOptions,
) => Promise<RasterTranscodeResult | null>;

export interface CompressPageImageOptions {
  name?: string;
  maxDimension?: number;
  quality?: number;
  /** Injectable transcoder boundary so plain Node tests run without DOM/canvas. */
  transcodeRaster?: RasterTranscoder;
}

export interface CompressedPageImage {
  blob: Blob;
  mimeType: PageImageMimeType;
  name: string;
  width?: number;
  height?: number;
  compressed: boolean;
}

async function encodeCanvasBlob(
  canvas: HTMLCanvasElement,
  mimeType: PageImageMimeType,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (result) => {
        if (result && result.type === mimeType && result.size > 0) {
          resolve(result);
        } else {
          resolve(null);
        }
      },
      mimeType,
      quality,
    );
  });
}

async function decodeImageDimensionsAndDraw(
  blob: Blob,
  maxDimension: number,
): Promise<{
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
} | null> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    try {
      const target = computeTargetDimensions(
        bitmap.width,
        bitmap.height,
        maxDimension,
      );
      if (typeof OffscreenCanvas !== "undefined") {
        const canvas = new OffscreenCanvas(target.width, target.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, target.width, target.height);
        return { canvas, width: target.width, height: target.height };
      }
      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = target.width;
        canvas.height = target.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, target.width, target.height);
        return { canvas, width: target.width, height: target.height };
      }
      return null;
    } finally {
      bitmap.close();
    }
  }

  if (typeof document === "undefined" || typeof Image === "undefined") {
    return null;
  }

  const tempUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to decode image."));
      el.src = tempUrl;
    });
    const target = computeTargetDimensions(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      maxDimension,
    );
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, target.width, target.height);
    return { canvas, width: target.width, height: target.height };
  } finally {
    URL.revokeObjectURL(tempUrl);
  }
}

async function transcodeRasterInBrowser(
  blob: Blob,
  { maxDimension, quality }: RasterTranscodeOptions,
): Promise<RasterTranscodeResult | null> {
  const rendered = await decodeImageDimensionsAndDraw(blob, maxDimension);
  if (!rendered) return null;

  const { canvas, width, height } = rendered;

  if (
    typeof OffscreenCanvas !== "undefined" &&
    canvas instanceof OffscreenCanvas
  ) {
    try {
      const webp = await canvas.convertToBlob({ type: "image/webp", quality });
      if (webp.type === "image/webp" && webp.size > 0) {
        return { blob: webp, mimeType: "image/webp", width, height };
      }
    } catch {
      // Fall through to JPEG when WebP encoding is unsupported.
    }
    try {
      const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality });
      if (jpeg.type === "image/jpeg" && jpeg.size > 0) {
        return { blob: jpeg, mimeType: "image/jpeg", width, height };
      }
    } catch {
      return null;
    }
    return null;
  }

  const htmlCanvas = canvas as HTMLCanvasElement;
  const webp = await encodeCanvasBlob(htmlCanvas, "image/webp", quality);
  if (webp) {
    return { blob: webp, mimeType: "image/webp", width, height };
  }
  const jpeg = await encodeCanvasBlob(htmlCanvas, "image/jpeg", quality);
  if (jpeg) {
    return { blob: jpeg, mimeType: "image/jpeg", width, height };
  }
  return null;
}

/**
 * Validates and compresses a local Page image upload:
 * - Enforces the accepted MIME whitelist (`jpeg`, `png`, `webp`, `gif`) and
 *   10 MB hard size cap, throwing `PageImageValidationError` on rejection.
 * - Preserves animated GIFs unmodified.
 * - Downscales raster images (`jpeg`, `png`, `webp`) over 1920px longest edge
 *   and re-encodes to WebP (falling back to JPEG) at ~0.82 quality.
 * - Keeps the original blob whenever compressed output is not smaller or
 *   canvas transcoding is unavailable.
 */
export async function compressPageImage(
  file: Blob,
  options?: CompressPageImageOptions,
): Promise<CompressedPageImage> {
  const validation = validatePageImageUpload({
    type: file.type,
    size: file.size,
  });
  if (!validation.ok) {
    throw new PageImageValidationError(validation.code);
  }

  const rawName =
    options?.name ??
    (typeof File !== "undefined" && file instanceof File
      ? file.name
      : undefined);
  const originalMime = validation.mimeType;

  if (originalMime === "image/gif") {
    return {
      blob: file,
      mimeType: "image/gif",
      name: deriveAssetFileName(rawName, "image/gif"),
      compressed: false,
    };
  }

  const maxDimension = options?.maxDimension ?? PAGE_IMAGE_MAX_DIMENSION;
  const quality = options?.quality ?? PAGE_IMAGE_COMPRESSION_QUALITY;
  const transcoder = options?.transcodeRaster ?? transcodeRasterInBrowser;

  try {
    const transcoded = await transcoder(file, { maxDimension, quality });
    if (
      transcoded &&
      transcoded.blob.size > 0 &&
      transcoded.blob.size < file.size
    ) {
      return {
        blob: transcoded.blob,
        mimeType: transcoded.mimeType,
        name: deriveAssetFileName(rawName, transcoded.mimeType),
        width: transcoded.width,
        height: transcoded.height,
        compressed: true,
      };
    }

    return {
      blob: file,
      mimeType: originalMime,
      name: deriveAssetFileName(rawName, originalMime),
      width: transcoded?.width,
      height: transcoded?.height,
      compressed: false,
    };
  } catch {
    return {
      blob: file,
      mimeType: originalMime,
      name: deriveAssetFileName(rawName, originalMime),
      compressed: false,
    };
  }
}
