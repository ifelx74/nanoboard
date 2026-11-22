import { createId } from "@paralleldrive/cuid2";
import type { NanoboardDB } from "./db";
import type { PageAsset } from "./schema";
import { extractAssetIds } from "../pages/document";
import {
  PageImageValidationError,
  deriveAssetFileName,
  validatePageImageUpload,
} from "../pages/image-upload";

export interface SavePageAssetInput {
  pageId: string;
  projectId: string;
  name: string;
  mimeType: string;
  blob: Blob;
  /** Optional pre-allocated cuid2 ID; defaults to `createId()`. */
  id?: string;
}

/**
 * Validates and persists a binary image `Blob` owned by a Page into
 * `pageAssets`. Rejects unsupported MIME types, files exceeding 10 MB, and
 * missing or cross-project pages without writing any rows.
 */
export async function savePageAsset(
  database: NanoboardDB,
  input: SavePageAssetInput,
): Promise<PageAsset> {
  const effectiveMime = input.mimeType || input.blob.type;
  const validation = validatePageImageUpload({
    type: effectiveMime,
    size: input.blob.size,
  });
  if (!validation.ok) {
    throw new PageImageValidationError(validation.code);
  }

  const asset: PageAsset = {
    id: input.id ?? createId(),
    pageId: input.pageId,
    projectId: input.projectId,
    name: deriveAssetFileName(input.name, validation.mimeType),
    mimeType: validation.mimeType,
    size: input.blob.size,
    blob: input.blob,
    createdAt: Date.now(),
  };

  await database.transaction(
    "rw",
    [database.pages, database.pageAssets],
    async () => {
      const page = await database.pages.get(input.pageId);
      if (!page) {
        throw new Error("Page not found.");
      }
      if (page.projectId !== input.projectId) {
        throw new Error("Page does not belong to project.");
      }
      await database.pageAssets.add(asset);
    },
  );

  return asset;
}

/** Reads a single `PageAsset` row by primary key. */
export function getPageAsset(
  database: NanoboardDB,
  assetId: string,
): Promise<PageAsset | undefined> {
  return database.pageAssets.get(assetId);
}

/**
 * Lists all `PageAsset` rows owned by `pageId`, ordered deterministically by
 * `createdAt` ascending (tie-broken by `id`).
 */
export async function getPageAssets(
  database: NanoboardDB,
  pageId: string,
): Promise<PageAsset[]> {
  const rows = await database.pageAssets
    .where("pageId")
    .equals(pageId)
    .toArray();
  rows.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return rows;
}

export interface PruneOrphanPageAssetsOptions {
  /**
   * When supplied, only unreferenced assets created strictly before this epoch
   * ms timestamp are deleted. Used for defensive load-time pruning so a newly
   * uploaded asset in the current session is never evicted before autosave.
   */
  olderThan?: number;
}

/**
 * Atomically deletes `pageAssets` rows owned by `pageId` whose IDs are not
 * referenced anywhere in the persisted `pageContents.contentJson`. Scoped
 * strictly to `pageId`; never touches other pages' assets. Returns the IDs
 * of deleted orphan assets.
 */
export async function pruneOrphanPageAssets(
  database: NanoboardDB,
  pageId: string,
  options?: PruneOrphanPageAssetsOptions,
): Promise<string[]> {
  const olderThan = options?.olderThan;

  return database.transaction(
    "rw",
    [database.pageContents, database.pageAssets],
    async () => {
      const content = await database.pageContents.get(pageId);
      const referencedIds = extractAssetIds(content?.contentJson);
      const pageAssets = await database.pageAssets
        .where("pageId")
        .equals(pageId)
        .toArray();

      const orphanIds = pageAssets
        .filter((asset) => {
          if (referencedIds.has(asset.id)) return false;
          if (olderThan !== undefined && asset.createdAt >= olderThan) {
            return false;
          }
          return true;
        })
        .map((asset) => asset.id);

      if (orphanIds.length > 0) {
        await database.pageAssets.bulkDelete(orphanIds);
      }
      return orphanIds;
    },
  );
}
