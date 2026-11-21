import { describe, expect, it } from "vitest";
import { STICKY_COLORS } from "@/lib/db/schema";
import {
  getPageBackgroundColorVar,
  getPageColor,
  getPageTextColorVar,
  isPageColorKey,
  PAGE_COLOR_KEYS,
  PAGE_COLORS,
} from "./colors";

describe("pages semantic color palette", () => {
  it("exposes the 8 Plane semantic color keys matching nanoboard sticky palette", () => {
    expect(PAGE_COLOR_KEYS).toEqual([
      "gray",
      "peach",
      "pink",
      "orange",
      "green",
      "light-blue",
      "dark-blue",
      "purple",
    ]);
    expect(PAGE_COLOR_KEYS).toEqual(STICKY_COLORS);
    expect(PAGE_COLORS).toHaveLength(8);
  });

  it("maps each semantic key to its text and background CSS variable tokens", () => {
    expect(getPageTextColorVar("peach")).toBe(
      "var(--editor-colors-peach-text)",
    );
    expect(getPageBackgroundColorVar("light-blue")).toBe(
      "var(--editor-colors-light-blue-background)",
    );

    const purple = getPageColor("purple");
    expect(purple).toEqual({
      key: "purple",
      textVar: "var(--editor-colors-purple-text)",
      backgroundVar: "var(--editor-colors-purple-background)",
    });
  });

  it("validates semantic keys strictly and rejects arbitrary CSS or hex strings", () => {
    expect(isPageColorKey("gray")).toBe(true);
    expect(isPageColorKey("dark-blue")).toBe(true);
    expect(isPageColorKey("#ff5b59")).toBe(false);
    expect(isPageColorKey("red")).toBe(false);
    expect(isPageColorKey("gray; background: url(javascript:alert(1))")).toBe(
      false,
    );
    expect(isPageColorKey("")).toBe(false);
    expect(isPageColorKey(null)).toBe(false);
    expect(isPageColorKey(undefined)).toBe(false);
    expect(getPageColor("invalid")).toBeUndefined();
    expect(getPageColor(null)).toBeUndefined();
  });
});
