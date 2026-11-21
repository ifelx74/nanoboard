import { db } from "@/lib/db/db";
import { getPageAsset } from "@/lib/db/page-assets";
import type { PageAsset } from "@/lib/db/schema";

export interface PageAssetUrlEntry {
  assetId: string;
  url: string;
  asset?: PageAsset;
}

export interface PageAssetUrlCacheDeps {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  loadAsset?: (assetId: string) => Promise<PageAsset | undefined>;
}

/**
 * Page-scoped ObjectURL registry. Allocates at most one `URL.createObjectURL`
 * per `assetId` across all TipTap Image NodeViews and Ticket 07's right-pane
 * Assets tab, deduplicates concurrent IndexedDB reads, and revokes every URL
 * on page unmount or page switch.
 */
export interface PageAssetUrlCache {
  /** Synchronously returns an already-allocated ObjectURL for `assetId`, if cached. */
  getCachedUrl(assetId: string): string | undefined;
  /** Synchronously returns an already-loaded PageAsset row for `assetId`, if cached. */
  getCachedAsset(assetId: string): PageAsset | undefined;
  /**
   * Registers a freshly saved asset/blob immediately so subsequent reads reuse
   * the same single ObjectURL without hitting IndexedDB again.
   */
  register(assetId: string, blob: Blob, asset?: PageAsset): string;
  /**
   * Resolves the single ObjectURL for `assetId`, deduplicating concurrent loads.
   * Returns `null` if the asset does not exist or the cache was cleared while
   * loading.
   */
  acquire(assetId: string): Promise<string | null>;
  /**
   * Resolves both the `PageAsset` row and its single cached ObjectURL.
   * Designed for Download actions and the right-pane Assets tab.
   */
  acquireEntry(assetId: string): Promise<PageAssetUrlEntry | null>;
  /** Revokes and evicts a single cached entry if present. */
  revoke(assetId: string): void;
  /**
   * Revokes every currently allocated ObjectURL, clears cached state, and
   * invalidates any in-flight loads so stale resolutions never leak URLs.
   * Idempotent.
   */
  revokeAll(): void;
  /** Number of currently active ObjectURLs held by this cache. */
  readonly size: number;
}

interface CacheRecord {
  url: string;
  asset?: PageAsset;
}

export function createPageAssetUrlCache(
  deps: PageAssetUrlCacheDeps = {},
): PageAssetUrlCache {
  const createUrl =
    deps.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeUrl =
    deps.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));
  const loadAsset =
    deps.loadAsset ?? ((assetId: string) => getPageAsset(db, assetId));

  const records = new Map<string, CacheRecord>();
  const inflight = new Map<string, Promise<PageAssetUrlEntry | null>>();
  let generation = 0;

  function register(assetId: string, blob: Blob, asset?: PageAsset): string {
    const existing = records.get(assetId);
    if (existing) {
      if (asset && !existing.asset) {
        existing.asset = asset;
      }
      return existing.url;
    }
    const url = createUrl(blob);
    records.set(assetId, { url, asset });
    return url;
  }

  function acquireEntry(assetId: string): Promise<PageAssetUrlEntry | null> {
    const existing = records.get(assetId);
    if (existing && existing.asset) {
      return Promise.resolve({
        assetId,
        url: existing.url,
        asset: existing.asset,
      });
    }

    const pending = inflight.get(assetId);
    if (pending) {
      return pending;
    }

    const startGeneration = generation;
    const promise: Promise<PageAssetUrlEntry | null> = loadAsset(assetId)
      .then((asset): PageAssetUrlEntry | null => {
        // Ignore stale completions if revokeAll() or revoke(assetId) ran in the meantime.
        if (
          generation !== startGeneration ||
          inflight.get(assetId) !== promise
        ) {
          return null;
        }
        if (!asset) {
          return null;
        }
        const url = register(assetId, asset.blob, asset);
        return { assetId, url, asset };
      })
      .finally(() => {
        if (inflight.get(assetId) === promise) {
          inflight.delete(assetId);
        }
      });

    inflight.set(assetId, promise);
    return promise;
  }

  async function acquire(assetId: string): Promise<string | null> {
    const existing = records.get(assetId);
    if (existing) {
      return existing.url;
    }
    const entry = await acquireEntry(assetId);
    return entry ? entry.url : null;
  }

  function revoke(assetId: string): void {
    inflight.delete(assetId);
    const existing = records.get(assetId);
    if (!existing) return;
    records.delete(assetId);
    revokeUrl(existing.url);
  }

  function revokeAll(): void {
    generation += 1;
    inflight.clear();
    if (records.size === 0) return;
    const urls = Array.from(records.values(), (entry) => entry.url);
    records.clear();
    for (const url of urls) {
      revokeUrl(url);
    }
  }

  return {
    getCachedUrl: (assetId: string) => records.get(assetId)?.url,
    getCachedAsset: (assetId: string) => records.get(assetId)?.asset,
    register,
    acquire,
    acquireEntry,
    revoke,
    revokeAll,
    get size() {
      return records.size;
    },
  };
}
