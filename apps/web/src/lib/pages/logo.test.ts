import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_ICON_COLOR,
  PAGE_ICON_COLORS,
  isValidEmojiValue,
  isValidHexColor,
  isValidPageLogo,
  normalizePageLogo,
} from "./logo";

describe("page logo validation and normalization", () => {
  it("exposes Plane's 8 preset icon hex colors and default color", () => {
    expect(PAGE_ICON_COLORS).toHaveLength(8);
    expect(PAGE_ICON_COLORS.every((color) => isValidHexColor(color))).toBe(
      true,
    );
    expect(isValidHexColor(DEFAULT_PAGE_ICON_COLOR)).toBe(true);
  });

  it("validates 3- and 6-digit hex colors and rejects arbitrary CSS strings", () => {
    expect(isValidHexColor("#6d7b8a")).toBe(true);
    expect(isValidHexColor("#3E77FD")).toBe(true);
    expect(isValidHexColor("#f0a")).toBe(true);

    expect(isValidHexColor("6d7b8a")).toBe(false);
    expect(isValidHexColor("#12345")).toBe(false);
    expect(isValidHexColor("#gggggg")).toBe(false);
    expect(isValidHexColor("red")).toBe(false);
    expect(isValidHexColor("#000; background: url(javascript:alert(1))")).toBe(
      false,
    );
    expect(isValidHexColor("")).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
  });

  it("validates Unicode emoji strings including ZWJ, flags, and keycaps while rejecting plain text or control chars", () => {
    expect(isValidEmojiValue("💡")).toBe(true);
    expect(isValidEmojiValue("🧭")).toBe(true);
    expect(isValidEmojiValue("🚀")).toBe(true);
    expect(isValidEmojiValue("👨‍👩‍👧‍👦")).toBe(true);
    expect(isValidEmojiValue("🏴󠁧󠁢󠁥󠁮󠁧󠁿")).toBe(true);
    expect(isValidEmojiValue("🇺🇸")).toBe(true);
    expect(isValidEmojiValue("1️⃣")).toBe(true);
    expect(isValidEmojiValue("©️")).toBe(true);

    expect(isValidEmojiValue("")).toBe(false);
    expect(isValidEmojiValue("   ")).toBe(false);
    expect(isValidEmojiValue("hello")).toBe(false);
    expect(isValidEmojiValue("123")).toBe(false);
    expect(isValidEmojiValue("<script>")).toBe(false);
    expect(isValidEmojiValue("hello 💡")).toBe(false);
    expect(isValidEmojiValue("💡\n")).toBe(false);
    expect(isValidEmojiValue("💡".repeat(20))).toBe(false);
    expect(isValidEmojiValue(null)).toBe(false);
  });

  it("validates emoji logos, colored Lucide project icons, and null removal", () => {
    expect(isValidPageLogo(null)).toBe(true);
    expect(isValidPageLogo({ type: "emoji", value: "💡" })).toBe(true);
    expect(
      isValidPageLogo({ type: "icon", name: "Layers", color: "#3e77fd" }),
    ).toBe(true);

    expect(isValidPageLogo(undefined)).toBe(false);
    expect(isValidPageLogo("💡")).toBe(false);
    expect(isValidPageLogo({ type: "emoji", value: "" })).toBe(false);
    expect(isValidPageLogo({ type: "emoji", value: "not-emoji" })).toBe(false);
    expect(
      isValidPageLogo({
        type: "icon",
        name: "NotARealIcon",
        color: "#3e77fd",
      }),
    ).toBe(false);
    expect(
      isValidPageLogo({ type: "icon", name: "Layers", color: "not-a-color" }),
    ).toBe(false);
    expect(isValidPageLogo({ type: "image", url: "https://x.test" })).toBe(
      false,
    );
  });

  it("normalizes valid logos into clean objects and throws on invalid shapes", () => {
    expect(normalizePageLogo(null)).toBeNull();

    expect(normalizePageLogo({ type: "emoji", value: "  🚀  " })).toEqual({
      type: "emoji",
      value: "🚀",
    });

    expect(
      normalizePageLogo({ type: "icon", name: "BookOpen", color: " #5e6ad2 " }),
    ).toEqual({
      type: "icon",
      name: "BookOpen",
      color: "#5e6ad2",
    });

    expect(() => normalizePageLogo({ type: "emoji", value: "abc" })).toThrow(
      "Invalid page logo.",
    );
    expect(() =>
      normalizePageLogo({
        type: "icon",
        name: "UnknownIcon",
        color: "#5e6ad2",
      }),
    ).toThrow("Invalid page logo.");
    expect(() =>
      normalizePageLogo({ type: "icon", name: "BookOpen", color: "blue" }),
    ).toThrow("Invalid page logo.");
  });
});
