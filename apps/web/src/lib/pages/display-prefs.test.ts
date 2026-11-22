import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_DISPLAY_PREFS,
  PAGE_DISPLAY_PREF_KEYS,
  readPageDisplayPrefs,
  writePageDisplayPrefs,
  type PagePrefsStorage,
} from "./display-prefs";

function createMemoryStorage(
  initial: Record<string, string> = {},
): PagePrefsStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("pages display preferences storage", () => {
  it("falls back to normal width (false) and sticky toolbar enabled (true)", () => {
    expect(DEFAULT_PAGE_DISPLAY_PREFS).toEqual({
      isFullWidth: false,
      isStickyToolbarEnabled: true,
    });
    expect(readPageDisplayPrefs(createMemoryStorage())).toEqual(
      DEFAULT_PAGE_DISPLAY_PREFS,
    );
    expect(readPageDisplayPrefs(null)).toEqual(DEFAULT_PAGE_DISPLAY_PREFS);
  });

  it("reads persisted boolean preferences and ignores corrupt values", () => {
    const storage = createMemoryStorage({
      [PAGE_DISPLAY_PREF_KEYS.fullWidth]: "true",
      [PAGE_DISPLAY_PREF_KEYS.stickyToolbar]: "false",
    });

    expect(readPageDisplayPrefs(storage)).toEqual({
      isFullWidth: true,
      isStickyToolbarEnabled: false,
    });

    const corrupt = createMemoryStorage({
      [PAGE_DISPLAY_PREF_KEYS.fullWidth]: "invalid",
      [PAGE_DISPLAY_PREF_KEYS.stickyToolbar]: "not-a-bool",
    });

    expect(readPageDisplayPrefs(corrupt)).toEqual(DEFAULT_PAGE_DISPLAY_PREFS);
  });

  it("writes partial preference updates and survives throwing storage", () => {
    const storage = createMemoryStorage();
    writePageDisplayPrefs({ isFullWidth: true }, storage);
    expect(readPageDisplayPrefs(storage)).toEqual({
      isFullWidth: true,
      isStickyToolbarEnabled: true,
    });

    writePageDisplayPrefs({ isStickyToolbarEnabled: false }, storage);
    expect(readPageDisplayPrefs(storage)).toEqual({
      isFullWidth: true,
      isStickyToolbarEnabled: false,
    });

    const broken: PagePrefsStorage = {
      getItem() {
        throw new Error("storage blocked");
      },
      setItem() {
        throw new Error("quota exceeded");
      },
    };

    expect(readPageDisplayPrefs(broken)).toEqual(DEFAULT_PAGE_DISPLAY_PREFS);
    expect(() =>
      writePageDisplayPrefs({ isFullWidth: true }, broken),
    ).not.toThrow();
  });
});
