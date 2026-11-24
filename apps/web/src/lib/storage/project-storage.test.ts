import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "../db/test-db";
import {
  boardFiltersStorageKey,
  clearAllProjectStorage,
  clearProjectStorage,
} from "./project-storage";

describe("clearProjectStorage & clearAllProjectStorage", () => {
  it("removes only the deleted project's key", () => {
    const keyA = boardFiltersStorageKey("proj-a");
    const keyB = boardFiltersStorageKey("proj-b");
    const storage = createMemoryStorage({
      [keyA]: JSON.stringify({ labels: ["1"] }),
      [keyB]: JSON.stringify({ labels: ["2"] }),
      "nanoboard-theme": "dark",
    });

    clearProjectStorage("proj-a", storage);

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

    clearAllProjectStorage(storage);

    expect(storage.entries.has(keyA)).toBe(false);
    expect(storage.entries.has(keyB)).toBe(false);
    expect(storage.entries.get("nanoboard-theme")).toBe("dark");
    expect(storage.entries.get("nanoboard-backup-status")).toBe("{}");
  });
});
