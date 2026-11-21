import { describe, expect, it } from "vitest";
import {
  CALLOUT_PREF_KEYS,
  DEFAULT_CALLOUT_EMOJI,
  DEFAULT_CALLOUT_LOGO,
  buildInitialCalloutAttrs,
  calloutAttrsToLogo,
  logoToCalloutAttrs,
  readCalloutPrefs,
  writeCalloutBackgroundColorPref,
  writeCalloutLogoPref,
  type CalloutPrefsStorage,
} from "./callout-prefs";
import { DEFAULT_PAGE_ICON_COLOR } from "./logo";

function createMemoryStorage(
  initial: Record<string, string> = {},
): CalloutPrefsStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

describe("callout defaults and localStorage persistence", () => {
  it("falls back to 💡 emoji and null background when storage is empty or unavailable", () => {
    expect(DEFAULT_CALLOUT_EMOJI).toBe("💡");
    expect(DEFAULT_CALLOUT_LOGO).toEqual({ type: "emoji", value: "💡" });

    expect(readCalloutPrefs(createMemoryStorage())).toEqual({
      logo: { type: "emoji", value: "💡" },
      backgroundColor: null,
    });
    expect(readCalloutPrefs(null)).toEqual({
      logo: { type: "emoji", value: "💡" },
      backgroundColor: null,
    });
    expect(buildInitialCalloutAttrs(null)).toEqual({
      logoType: "emoji",
      emoji: "💡",
      iconName: null,
      iconColor: null,
      backgroundColor: null,
    });
  });

  it("persists and restores emoji logos, colored Lucide icons, and semantic background colors", () => {
    const storage = createMemoryStorage();

    writeCalloutLogoPref({ type: "emoji", value: "🔥" }, storage);
    writeCalloutBackgroundColorPref("orange", storage);

    expect(readCalloutPrefs(storage)).toEqual({
      logo: { type: "emoji", value: "🔥" },
      backgroundColor: "orange",
    });
    expect(buildInitialCalloutAttrs(storage)).toEqual({
      logoType: "emoji",
      emoji: "🔥",
      iconName: null,
      iconColor: null,
      backgroundColor: "orange",
    });

    writeCalloutLogoPref(
      { type: "icon", name: "Shield", color: "#02b55c" },
      storage,
    );
    writeCalloutBackgroundColorPref("green", storage);

    expect(readCalloutPrefs(storage)).toEqual({
      logo: { type: "icon", name: "Shield", color: "#02b55c" },
      backgroundColor: "green",
    });
    expect(buildInitialCalloutAttrs(storage)).toEqual({
      logoType: "icon",
      emoji: "💡",
      iconName: "Shield",
      iconColor: "#02b55c",
      backgroundColor: "green",
    });

    // Clearing background color removes stored background while preserving last icon.
    writeCalloutBackgroundColorPref(null, storage);
    expect(storage.getItem(CALLOUT_PREF_KEYS.backgroundColor)).toBeNull();
    expect(readCalloutPrefs(storage)).toEqual({
      logo: { type: "icon", name: "Shield", color: "#02b55c" },
      backgroundColor: null,
    });
  });

  it("ignores corrupt JSON, invalid logo payloads, and non-semantic CSS background values", () => {
    const corruptJson = createMemoryStorage({
      [CALLOUT_PREF_KEYS.logo]: "{not-valid-json",
      [CALLOUT_PREF_KEYS.backgroundColor]: "#ff5b59",
    });
    expect(readCalloutPrefs(corruptJson)).toEqual({
      logo: DEFAULT_CALLOUT_LOGO,
      backgroundColor: null,
    });

    const invalidIcon = createMemoryStorage({
      [CALLOUT_PREF_KEYS.logo]: JSON.stringify({
        type: "icon",
        name: "BadIcon",
        color: "#5e6ad2",
      }),
      [CALLOUT_PREF_KEYS.backgroundColor]:
        "gray; background: url(javascript:alert(1))",
    });
    expect(readCalloutPrefs(invalidIcon)).toEqual({
      logo: DEFAULT_CALLOUT_LOGO,
      backgroundColor: null,
    });

    const nullLogo = createMemoryStorage({
      [CALLOUT_PREF_KEYS.logo]: "null",
      [CALLOUT_PREF_KEYS.backgroundColor]: "purple",
    });
    expect(readCalloutPrefs(nullLogo)).toEqual({
      logo: DEFAULT_CALLOUT_LOGO,
      backgroundColor: "purple",
    });
  });

  it("survives throwing storage without crashing reads or writes", () => {
    const broken: CalloutPrefsStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota exceeded");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };

    expect(readCalloutPrefs(broken)).toEqual({
      logo: DEFAULT_CALLOUT_LOGO,
      backgroundColor: null,
    });
    expect(() =>
      writeCalloutLogoPref({ type: "emoji", value: "🚀" }, broken),
    ).not.toThrow();
    expect(() =>
      writeCalloutBackgroundColorPref("light-blue", broken),
    ).not.toThrow();
    expect(() => writeCalloutBackgroundColorPref(null, broken)).not.toThrow();
  });

  it("converts safely between callout node attrs and PageLogo", () => {
    expect(logoToCalloutAttrs({ type: "emoji", value: "📌" })).toEqual({
      logoType: "emoji",
      emoji: "📌",
      iconName: null,
      iconColor: null,
    });

    expect(
      logoToCalloutAttrs({ type: "icon", name: "Lightbulb", color: "#e57a00" }),
    ).toEqual({
      logoType: "icon",
      emoji: DEFAULT_CALLOUT_EMOJI,
      iconName: "Lightbulb",
      iconColor: "#e57a00",
    });

    expect(
      calloutAttrsToLogo({
        logoType: "icon",
        iconName: "Lightbulb",
        iconColor: "#e57a00",
      }),
    ).toEqual({ type: "icon", name: "Lightbulb", color: "#e57a00" });

    // Falls back to default icon color when iconName is valid but iconColor is invalid.
    expect(
      calloutAttrsToLogo({
        logoType: "icon",
        iconName: "Flag",
        iconColor: "invalid",
      }),
    ).toEqual({
      type: "icon",
      name: "Flag",
      color: DEFAULT_PAGE_ICON_COLOR,
    });

    // Falls back to default 💡 emoji when attrs are incomplete or invalid.
    expect(
      calloutAttrsToLogo({
        logoType: "icon",
        iconName: "Unknown",
        iconColor: "#5e6ad2",
      }),
    ).toEqual(DEFAULT_CALLOUT_LOGO);
    expect(
      calloutAttrsToLogo({ logoType: "emoji", emoji: "not-emoji" }),
    ).toEqual(DEFAULT_CALLOUT_LOGO);
  });
});
