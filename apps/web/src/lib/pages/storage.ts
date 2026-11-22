export interface PageStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Safely resolves `localStorage` from the given global host, returning `null`
 * in plain Node environments or restricted browsing contexts where accessing
 * `localStorage` throws.
 */
export function getDefaultPageStorage(
  host: { localStorage?: PageStorageLike } | undefined = typeof globalThis !==
  "undefined"
    ? (globalThis as { localStorage?: PageStorageLike })
    : undefined,
): PageStorageLike | null {
  try {
    if (!host || !("localStorage" in host)) return null;
    const storage = host.localStorage;
    if (
      !storage ||
      typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function" ||
      typeof storage.removeItem !== "function"
    ) {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}
