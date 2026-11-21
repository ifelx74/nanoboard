import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createPageAssetUrlCache,
  type PageAssetUrlCache,
} from "@/lib/pages/object-url-cache";

interface PageAssetUrlContextValue {
  pageId: string;
  cache: PageAssetUrlCache;
}

const PageAssetUrlContext = createContext<PageAssetUrlContextValue | null>(
  null,
);

export interface PageAssetUrlProviderProps {
  /** Active page ID; switching pages creates a fresh cache and revokes the old one. */
  pageId: string;
  /** Optional externally owned cache (e.g. shared across editor and right pane). */
  cache?: PageAssetUrlCache;
  children: ReactNode;
}

/**
 * Provides a single page-scoped `PageAssetUrlCache` to all TipTap Image
 * NodeViews and Ticket 07's right-pane Assets tab. Automatically reuses a
 * matching ancestor provider for the same `pageId` so nested mounts never
 * allocate duplicate object URLs, and revokes every URL it owns on unmount
 * or page switch.
 */
export function PageAssetUrlProvider({
  pageId,
  cache: externalCache,
  children,
}: PageAssetUrlProviderProps) {
  const parent = useContext(PageAssetUrlContext);
  const inheritedCache =
    parent && parent.pageId === pageId ? parent.cache : null;
  const shouldOwnCache = !externalCache && !inheritedCache;

  const ownedCache = useMemo(
    () => (shouldOwnCache ? createPageAssetUrlCache() : null),
    // Recreate whenever pageId changes so page switches revoke the prior cache.
    [shouldOwnCache, pageId],
  );

  useEffect(() => {
    if (!ownedCache) return;
    return () => {
      ownedCache.revokeAll();
    };
  }, [ownedCache]);

  const activeCache = externalCache ?? inheritedCache ?? ownedCache;
  const value = useMemo<PageAssetUrlContextValue | null>(
    () => (activeCache ? { pageId, cache: activeCache } : null),
    [pageId, activeCache],
  );

  return (
    <PageAssetUrlContext.Provider value={value}>
      {children}
    </PageAssetUrlContext.Provider>
  );
}

/** Returns the active page-scoped `PageAssetUrlCache`, or `null` outside a provider. */
export function useOptionalPageAssetUrlCache(): PageAssetUrlCache | null {
  return useContext(PageAssetUrlContext)?.cache ?? null;
}

/** Returns the active page-scoped `PageAssetUrlCache`. Throws outside `PageAssetUrlProvider`. */
export function usePageAssetUrlCache(): PageAssetUrlCache {
  const ctx = useContext(PageAssetUrlContext);
  if (!ctx) {
    throw new Error(
      "usePageAssetUrlCache must be used within a PageAssetUrlProvider.",
    );
  }
  return ctx.cache;
}

export interface UsePageAssetUrlResult {
  url: string | null;
  loading: boolean;
  missing: boolean;
}

/**
 * Resolves a local `pageAssets` ID to its shared ObjectURL from the page-scoped
 * cache. Safe under React StrictMode and rapid page switches.
 */
export function usePageAssetUrl(
  assetId: string | null | undefined,
  cacheOverride?: PageAssetUrlCache,
): UsePageAssetUrlResult {
  const contextCache = useOptionalPageAssetUrlCache();
  const cache = cacheOverride ?? contextCache;

  const syncUrl =
    assetId && cache ? (cache.getCachedUrl(assetId) ?? null) : null;
  const [resolved, setResolved] = useState<{
    assetId: string;
    url: string | null;
    missing: boolean;
  } | null>(() =>
    assetId && syncUrl ? { assetId, url: syncUrl, missing: false } : null,
  );

  useEffect(() => {
    if (!assetId || !cache) {
      return;
    }

    const cached = cache.getCachedUrl(assetId);
    if (cached) {
      setResolved({ assetId, url: cached, missing: false });
      return;
    }

    let cancelled = false;
    void cache
      .acquire(assetId)
      .then((nextUrl) => {
        if (cancelled) return;
        setResolved({
          assetId,
          url: nextUrl,
          missing: nextUrl === null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResolved({ assetId, url: null, missing: true });
      });

    return () => {
      cancelled = true;
    };
  }, [assetId, cache]);

  if (!assetId || !cache) {
    return { url: null, loading: false, missing: false };
  }

  if (syncUrl) {
    return { url: syncUrl, loading: false, missing: false };
  }

  if (resolved && resolved.assetId === assetId) {
    return {
      url: resolved.url,
      loading: false,
      missing: resolved.missing,
    };
  }

  return { url: null, loading: true, missing: false };
}
