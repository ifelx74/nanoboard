import { describe, expect, it } from "vitest";
import {
  EMPTY_BOARD_FILTERS,
  normalizeBoardFilters,
  type BoardFilters,
} from "./board-filter-model";
import {
  boardFiltersStorageKey,
  clearAllBoardFiltersStorage,
  clearBoardFiltersStorage,
  readBoardFiltersStorage,
  syncBoardFiltersStorage,
  type BoardFiltersStorageLike,
} from "./board-filter-storage";

function createMemoryStorage(
  initial: Record<string, string> = {},
): BoardFiltersStorageLike & {
  entries: Map<string, string>;
  setCalls: number;
  removeCalls: number;
} {
  const entries = new Map<string, string>(Object.entries(initial));
  const store = {
    entries,
    setCalls: 0,
    removeCalls: 0,
    get length() {
      return entries.size;
    },
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.setCalls += 1;
      entries.set(key, value);
    },
    removeItem(key: string) {
      store.removeCalls += 1;
      entries.delete(key);
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null;
    },
  };
  return store;
}

describe("syncBoardFiltersStorage", () => {
  it("does not write anything when filters are empty and no key exists", () => {
    const storage = createMemoryStorage();
    syncBoardFiltersStorage(
      "proj-1",
      EMPTY_BOARD_FILTERS,
      { isEmpty: true, normalize: normalizeBoardFilters },
      storage,
    );
    expect(storage.entries.size).toBe(0);
    expect(storage.setCalls).toBe(0);
    expect(storage.removeCalls).toBe(0);
  });

  it("removes the key when filters return to empty", () => {
    const key = boardFiltersStorageKey("proj-1");
    const storage = createMemoryStorage({
      [key]: JSON.stringify({ ...EMPTY_BOARD_FILTERS, labels: ["lbl-1"] }),
    });

    syncBoardFiltersStorage(
      "proj-1",
      EMPTY_BOARD_FILTERS,
      { isEmpty: true, normalize: normalizeBoardFilters },
      storage,
    );

    expect(storage.entries.has(key)).toBe(false);
    expect(storage.removeCalls).toBe(1);
    expect(storage.setCalls).toBe(0);
  });

  it("removes stale all-null entries instead of keeping them", () => {
    const key = boardFiltersStorageKey("proj-1");
    const storage = createMemoryStorage({
      [key]: JSON.stringify(EMPTY_BOARD_FILTERS),
    });

    syncBoardFiltersStorage(
      "proj-1",
      EMPTY_BOARD_FILTERS,
      { isEmpty: true, normalize: normalizeBoardFilters },
      storage,
    );

    expect(storage.entries.has(key)).toBe(false);
    expect(storage.removeCalls).toBe(1);
  });

  it("persists active filters and preserves matching legacy shapes without rewriting", () => {
    const key = boardFiltersStorageKey("proj-1");
    const legacyRaw = JSON.stringify({ labels: ["lbl-1"] });
    const storage = createMemoryStorage({ [key]: legacyRaw });
    const active: BoardFilters = {
      ...EMPTY_BOARD_FILTERS,
      labels: ["lbl-1"],
    };

    syncBoardFiltersStorage(
      "proj-1",
      active,
      { isEmpty: false, normalize: normalizeBoardFilters },
      storage,
    );

    expect(storage.getItem(key)).toBe(legacyRaw);
    expect(storage.setCalls).toBe(0);

    const updated: BoardFilters = {
      ...EMPTY_BOARD_FILTERS,
      labels: ["lbl-1", "lbl-2"],
    };
    syncBoardFiltersStorage(
      "proj-1",
      updated,
      { isEmpty: false, normalize: normalizeBoardFilters },
      storage,
    );

    expect(storage.setCalls).toBe(1);
    expect(
      readBoardFiltersStorage(
        "proj-1",
        normalizeBoardFilters,
        EMPTY_BOARD_FILTERS,
        storage,
      ),
    ).toEqual(updated);
  });

  it("overwrites corrupt JSON when saving active filters", () => {
    const key = boardFiltersStorageKey("proj-1");
    const storage = createMemoryStorage({ [key]: "{corrupt" });
    const active: BoardFilters = {
      ...EMPTY_BOARD_FILTERS,
      priority: ["high"],
    };

    syncBoardFiltersStorage(
      "proj-1",
      active,
      { isEmpty: false, normalize: normalizeBoardFilters },
      storage,
    );

    expect(storage.setCalls).toBe(1);
    expect(
      readBoardFiltersStorage(
        "proj-1",
        normalizeBoardFilters,
        EMPTY_BOARD_FILTERS,
        storage,
      ),
    ).toEqual(active);
  });
});

describe("clearBoardFiltersStorage & clearAllBoardFiltersStorage", () => {
  it("removes only the deleted project's key", () => {
    const keyA = boardFiltersStorageKey("proj-a");
    const keyB = boardFiltersStorageKey("proj-b");
    const storage = createMemoryStorage({
      [keyA]: JSON.stringify({ labels: ["1"] }),
      [keyB]: JSON.stringify({ labels: ["2"] }),
      "nanoboard-theme": "dark",
    });

    clearBoardFiltersStorage("proj-a", storage);

    expect(storage.entries.has(keyA)).toBe(false);
    expect(storage.entries.has(keyB)).toBe(true);
    expect(storage.entries.has("nanoboard-theme")).toBe(true);
  });

  it("sweeps all board-filter keys while leaving unrelated keys intact", () => {
    const keyA = boardFiltersStorageKey("proj-a");
    const keyB = boardFiltersStorageKey("proj-b");
    const storage = createMemoryStorage({
      [keyA]: JSON.stringify({ labels: ["1"] }),
      "nanoboard-theme": "dark",
      [keyB]: JSON.stringify({ priority: ["urgent"] }),
      "nanoboard-backup-status": "{}",
    });

    clearAllBoardFiltersStorage(storage);

    expect(storage.entries.has(keyA)).toBe(false);
    expect(storage.entries.has(keyB)).toBe(false);
    expect(storage.entries.get("nanoboard-theme")).toBe("dark");
    expect(storage.entries.get("nanoboard-backup-status")).toBe("{}");
  });
});
