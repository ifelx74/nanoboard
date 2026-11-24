/**
 * Per-project browser `localStorage` cleanup helpers, kept DOM-free and
 * zero-dependency so persistence operations (`deleteProject`,
 * `applyBackupDocument`, `resetToSeed`) and plain-Node tests can sweep
 * per-project UI state without importing feature bundles.
 */

export const BOARD_FILTERS_STORAGE_PREFIX = "nanoboard:board-filters:";

export interface StorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export function boardFiltersStorageKey(projectId: string): string {
  return `${BOARD_FILTERS_STORAGE_PREFIX}${projectId}`;
}

export function resolveStorage(
  storage?: StorageLike | null,
): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    const candidate = window.localStorage;
    if (
      !candidate ||
      typeof candidate.getItem !== "function" ||
      typeof candidate.setItem !== "function" ||
      typeof candidate.removeItem !== "function" ||
      typeof candidate.key !== "function"
    ) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

/** Remove all per-project `localStorage` state for a deleted project. */
export function clearProjectStorage(
  projectId: string,
  storage?: StorageLike | null,
): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(boardFiltersStorageKey(projectId));
  } catch {
    // Ignore storage errors (unavailable / private mode).
  }
}

/** Sweep all per-project `localStorage` keys (used on backup restore & reset). */
export function clearAllProjectStorage(storage?: StorageLike | null): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (key?.startsWith(BOARD_FILTERS_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      target.removeItem(key);
    }
  } catch {
    // Ignore storage errors.
  }
}
