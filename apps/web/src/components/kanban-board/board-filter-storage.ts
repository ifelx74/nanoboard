/**
 * Per-project board-filter `localStorage` helpers, kept DOM-free and
 * zero-dependency so both boot-path delete dialogs and plain-Node tests can
 * import them without pulling in date/filter bundles.
 */

export const BOARD_FILTERS_STORAGE_PREFIX = "nanoboard:board-filters:";

export interface BoardFiltersStorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export function boardFiltersStorageKey(projectId: string): string {
  return `${BOARD_FILTERS_STORAGE_PREFIX}${projectId}`;
}

function resolveStorage(
  storage?: BoardFiltersStorageLike | null,
): BoardFiltersStorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Read and normalize persisted board filters for a single project. */
export function readBoardFiltersStorage<T>(
  projectId: string,
  normalize: (raw: unknown) => T,
  fallback: T,
  storage?: BoardFiltersStorageLike | null,
): T {
  const target = resolveStorage(storage);
  if (!target) return fallback;
  try {
    const raw = target.getItem(boardFiltersStorageKey(projectId));
    if (!raw) return fallback;
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return fallback;
  }
}

/**
 * Sync board filters to `localStorage`:
 * - When empty, remove any existing key (and skip writing when absent).
 * - When non-empty, avoid rewriting if the stored value already normalizes to
 *   the same state (preserving non-empty legacy shapes without migration).
 */
export function syncBoardFiltersStorage<T>(
  projectId: string,
  filters: T,
  options: {
    isEmpty: boolean;
    normalize: (raw: unknown) => T;
  },
  storage?: BoardFiltersStorageLike | null,
): void {
  const target = resolveStorage(storage);
  if (!target) return;

  const key = boardFiltersStorageKey(projectId);
  try {
    const raw = target.getItem(key);
    if (options.isEmpty) {
      if (raw !== null) {
        target.removeItem(key);
      }
      return;
    }

    if (raw !== null) {
      try {
        const stored = options.normalize(JSON.parse(raw) as unknown);
        if (JSON.stringify(stored) === JSON.stringify(filters)) return;
      } catch {
        // Malformed stored JSON — overwrite with the new valid filter state.
      }
    }

    target.setItem(key, JSON.stringify(filters));
  } catch {
    // Storage may be unavailable or full; keep filtering in memory.
  }
}

/** Remove persisted board filters for a deleted project. */
export function clearBoardFiltersStorage(
  projectId: string,
  storage?: BoardFiltersStorageLike | null,
): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(boardFiltersStorageKey(projectId));
  } catch {
    // Ignore storage errors.
  }
}

/** Sweep all per-project board-filter keys (used on whole-workspace restore). */
export function clearAllBoardFiltersStorage(
  storage?: BoardFiltersStorageLike | null,
): void {
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
