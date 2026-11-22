/**
 * Accepted safe raster image MIME types for local Page assets (`pageAssets`).
 * Excludes active/scriptable formats such as `image/svg+xml` and `text/html`.
 */
export const PAGE_IMAGE_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type PageImageMimeType = (typeof PAGE_IMAGE_ACCEPTED_MIME_TYPES)[number];
