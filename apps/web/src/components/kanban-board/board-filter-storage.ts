/**
 * Per-project board-filter `localStorage` read/sync helpers, kept DOM-free
 * so plain-Node tests can exercise filter persistence directly. Key sweeping
 * on project deletion and backup restore lives in `@/lib/storage/project-storage`.
 */

import {
  BOARD_FILTERS_STORAGE_PREFIX,
  boardFiltersStorageKey,
  resolveStorage,
  type StorageLike,
} from "@/lib/storage/project-storage";

export { BOARD_FILTERS_STORAGE_PREFIX, boardFiltersStorageKey };
export type BoardFiltersStorageLike = StorageLike;

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
