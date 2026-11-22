import { describe, expect, it } from "vitest";
import {
  EMOJI_CATEGORIES,
  LOCAL_EMOJI_GROUPS,
  LOCAL_PAGE_EMOJIS,
  POPULAR_EMOJIS,
  resolveEmojiCharByName,
  searchLocalEmojis,
} from "./emoji-data";
import { isValidEmojiValue } from "./logo";

describe("local Pages emoji catalog singleton", () => {
  it("strips all CDN fallbackImage URLs and contains only standalone Unicode emojis", () => {
    expect(LOCAL_PAGE_EMOJIS.length).toBeGreaterThan(1500);

    for (const item of LOCAL_PAGE_EMOJIS) {
      expect("fallbackImage" in item).toBe(false);
      expect(isValidEmojiValue(item.emoji)).toBe(true);
      expect(item.name.startsWith("regional_indicator_")).toBe(false);
    }
  });

  it("groups emojis cleanly into all 9 picker categories with non-empty sections", () => {
    expect(LOCAL_EMOJI_GROUPS.map((group) => group.key)).toEqual([
      ...EMOJI_CATEGORIES,
    ]);
    for (const group of LOCAL_EMOJI_GROUPS) {
      expect(group.items.length).toBeGreaterThan(20);
    }
  });

  it("provides a curated list of popular emojis for empty-query autocomplete", () => {
    expect(POPULAR_EMOJIS.length).toBeGreaterThanOrEqual(12);
    const chars = POPULAR_EMOJIS.map((item) => item.emoji);
    expect(chars).toContain("💡");
    expect(chars).toContain("🚀");
    expect(chars).toContain("🔥");
    expect(chars).toContain("✅");
  });

  it("ranks exact and prefix shortcode matches ahead of substring and tag matches", () => {
    const empty = searchLocalEmojis("", 8);
    expect(empty).toHaveLength(8);
    expect(empty).toEqual(POPULAR_EMOJIS.slice(0, 8));

    const rocket = searchLocalEmojis("rocket", 5);
    expect(rocket[0]?.emoji).toBe("🚀");

    const bulb = searchLocalEmojis("bulb", 5);
    expect(bulb[0]?.emoji).toBe("💡");

    // Case-insensitive and strips stray colons cleanly.
    const fire = searchLocalEmojis(":FIRE", 5);
    expect(fire[0]?.emoji).toBe("🔥");

    expect(searchLocalEmojis("zzzz-no-such-emoji-xyz", 10)).toEqual([]);
  });

  it("resolves canonical emoji names and shortcodes in O(1)", () => {
    expect(resolveEmojiCharByName("rocket")).toBe("🚀");
    expect(resolveEmojiCharByName("bulb")).toBe("💡");
    expect(resolveEmojiCharByName("fire")).toBe("🔥");
    expect(resolveEmojiCharByName("not_a_real_shortcode")).toBeUndefined();
  });
});
