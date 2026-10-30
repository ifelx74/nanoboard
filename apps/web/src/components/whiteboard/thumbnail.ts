import { exportToBlob, getDataURL, MIME_TYPES } from "@excalidraw/excalidraw";
import type { AppState } from "@excalidraw/excalidraw/types";
import type { Whiteboard } from "@/lib/db/schema";

/**
 * Thumbnail budget: the longest side is capped at 640px (never upscaled for
 * smaller scenes) and encoded as JPEG at quality 0.8 — lossy and bounded, so
 * a preview row stays in the tens of KB regardless of how large the scene is.
 * JPEG over webp because Safari's canvas.toBlob has no webp encoder.
 */
const THUMBNAIL_MAX_SIDE = 640;
const THUMBNAIL_JPEG_QUALITY = 0.8;

/**
 * The appState override for thumbnail exports, layered over the persisted
 * board state: thumbnails always paint the board's own canvas background
 * color (jpeg needs it anyway), never follow the dark-mode export pref (so
 * stored thumbnails are theme-stable — only a new save changes them), and pin
 * exportScale at 1 because the maxWidthOrHeight fallback reads the raw opts,
 * where the HiDPI default (devicePixelRatio) would leak in. Frame rendering
 * is switched off entirely so frame outlines and name labels never appear.
 * Pure — the input is never mutated.
 */
export function thumbnailAppState(
  appState: Partial<AppState>,
): Partial<AppState> {
  return {
    ...appState,
    exportBackground: true,
    exportWithDarkMode: false,
    exportScale: 1,
    frameRendering: { enabled: false, clip: false, name: false, outline: false },
  };
}

/**
 * What the preview row ends up storing for this flush: a successful render
 * replaces whatever was there, but a failed one is cosmetic — the row keeps
 * the thumbnail it already had, or the empty placeholder when the row is new
 * (the publish verdict itself still lands, because the row doubles as the
 * gallery's has-content index). Pure.
 */
export function resolveThumbnailDataUrl(
  rendered: string | null,
  priorDataUrl: string | undefined,
): string {
  if (rendered !== null) return rendered;
  return priorDataUrl ?? "";
}

/**
 * Renders the built scene payload (buildScenePayload output: non-deleted
 * elements, sanitized appState, files pruned to live references) to a small
 * JPEG data URL for the project's preview row. Detached — no mounted editor
 * is needed; the export wrapper restores elements/appState itself, ignores
 * scroll/zoom, and loads text fonts before rendering. Fails loudly (throws)
 * for a degenerate empty scene — the caller never routes those here — and
 * lets every export failure (canvas.toBlob returning null rejects with
 * "couldn't export to blob") propagate; the caller treats rendering as
 * cosmetic and keeps the prior thumbnail on failure.
 *
 * Lives in this module so `exportToBlob` is imported only inside the lazy
 * whiteboard editor chunk — the gallery route and every other route's bundle
 * must stay free of it (the PWA precache split depends on that).
 */
export async function renderWhiteboardThumbnail({
  elements,
  appState,
  files,
}: Pick<Whiteboard, "elements" | "appState" | "files">): Promise<string> {
  if (elements.length === 0) {
    throw new Error("Refusing to render a thumbnail for an empty scene");
  }
  const blob = await exportToBlob({
    elements,
    appState: thumbnailAppState(appState),
    files,
    maxWidthOrHeight: THUMBNAIL_MAX_SIDE,
    mimeType: MIME_TYPES.jpg,
    quality: THUMBNAIL_JPEG_QUALITY,
  });
  return getDataURL(blob);
}
