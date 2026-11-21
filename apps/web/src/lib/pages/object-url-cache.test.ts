import { describe, expect, it, vi } from "vitest";
import type { PageAsset } from "@/lib/db/schema";
import { createPageAssetUrlCache } from "./object-url-cache";

function makeAsset(id: string, text = "bytes"): PageAsset {
  const blob = new Blob([text], { type: "image/webp" });
  return {
    id,
    pageId: "page-1",
    projectId: "project-1",
    name: `${id}.webp`,
    mimeType: "image/webp",
    size: blob.size,
    blob,
    createdAt: 1_700_000_000_000,
  };
}

describe("createPageAssetUrlCache", () => {
  it("allocates at most one ObjectURL per assetId across sequential, concurrent, and pre-registered calls", async () => {
    let counter = 0;
    const createObjectURL = vi.fn(() => `blob:test/${++counter}`);
    const revokeObjectURL = vi.fn();
    const asset1 = makeAsset("asset-1", "img-1");
    const asset2 = makeAsset("asset-2", "img-2");
    const loadAsset = vi.fn(async (id: string) =>
      id === "asset-1" ? asset1 : id === "asset-2" ? asset2 : undefined,
    );

    const cache = createPageAssetUrlCache({
      createObjectURL,
      revokeObjectURL,
      loadAsset,
    });

    // Concurrent calls (e.g. Image NodeView + right-pane Assets tab) share one load and one URL.
    const [urlA, urlB, entryC] = await Promise.all([
      cache.acquire("asset-1"),
      cache.acquire("asset-1"),
      cache.acquireEntry("asset-1"),
    ]);

    expect(urlA).toBe("blob:test/1");
    expect(urlB).toBe("blob:test/1");
    expect(entryC).toEqual({
      assetId: "asset-1",
      url: "blob:test/1",
      asset: asset1,
    });
    expect(loadAsset).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(cache.getCachedUrl("asset-1")).toBe("blob:test/1");
    expect(cache.getCachedAsset("asset-1")).toBe(asset1);
    expect(cache.size).toBe(1);

    // Subsequent acquire hits cache synchronously without reloading or reallocating.
    expect(await cache.acquire("asset-1")).toBe("blob:test/1");
    expect(loadAsset).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    // Pre-registered upload immediately shares its single URL with acquire and acquireEntry.
    const registeredUrl = cache.register("asset-2", asset2.blob, asset2);
    expect(registeredUrl).toBe("blob:test/2");
    expect(cache.register("asset-2", asset2.blob, asset2)).toBe("blob:test/2");
    expect(await cache.acquire("asset-2")).toBe("blob:test/2");
    expect(await cache.acquireEntry("asset-2")).toEqual({
      assetId: "asset-2",
      url: "blob:test/2",
      asset: asset2,
    });
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(loadAsset).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(2);
  });

  it("revokes every allocated ObjectURL once on revokeAll and prevents in-flight loads from leaking", async () => {
    let counter = 0;
    const createObjectURL = vi.fn(() => `blob:test/${++counter}`);
    const revokeObjectURL = vi.fn();

    let resolvePending!: (asset: PageAsset | undefined) => void;
    const pendingPromise = new Promise<PageAsset | undefined>((resolve) => {
      resolvePending = resolve;
    });

    const asset1 = makeAsset("asset-1");
    const asset2 = makeAsset("asset-2");
    const loadAsset = vi.fn((id: string) => {
      if (id === "asset-1") return Promise.resolve(asset1);
      if (id === "asset-pending") return pendingPromise;
      if (id === "asset-2") return Promise.resolve(asset2);
      return Promise.resolve(undefined);
    });

    const cache = createPageAssetUrlCache({
      createObjectURL,
      revokeObjectURL,
      loadAsset,
    });

    const url1 = await cache.acquire("asset-1");
    expect(url1).toBe("blob:test/1");

    // Start an in-flight load before unmount/page-switch.
    const inflightAcquire = cache.acquire("asset-pending");

    // Unmount / page switch revokes all currently allocated URLs.
    cache.revokeAll();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
    expect(cache.size).toBe(0);
    expect(cache.getCachedUrl("asset-1")).toBeUndefined();

    // Idempotent second call does not double-revoke.
    cache.revokeAll();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    // Resolving the stale in-flight load must NOT allocate an ObjectURL.
    resolvePending(makeAsset("asset-pending"));
    expect(await inflightAcquire).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);

    // After a StrictMode remount cleanup, subsequent acquires still work cleanly.
    const remountUrl = await cache.acquire("asset-2");
    expect(remountUrl).toBe("blob:test/2");
    expect(cache.size).toBe(1);
    cache.revokeAll();
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:test/2");
  });

  it("handles missing assets without poisoning the cache and supports single-entry revoke", async () => {
    let counter = 0;
    const createObjectURL = vi.fn(() => `blob:test/${++counter}`);
    const revokeObjectURL = vi.fn();
    let available = false;
    const asset1 = makeAsset("asset-1");
    const loadAsset = vi.fn(async () => (available ? asset1 : undefined));

    const cache = createPageAssetUrlCache({
      createObjectURL,
      revokeObjectURL,
      loadAsset,
    });

    expect(await cache.acquire("asset-1")).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();

    available = true;
    expect(await cache.acquire("asset-1")).toBe("blob:test/1");
    expect(cache.size).toBe(1);

    cache.revoke("asset-1");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test/1");
    expect(cache.size).toBe(0);

    // Revoking an unknown id is a safe no-op.
    cache.revoke("never-cached");
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    // Can re-acquire after single-entry revoke.
    expect(await cache.acquire("asset-1")).toBe("blob:test/2");
    expect(cache.size).toBe(1);
  });
});
