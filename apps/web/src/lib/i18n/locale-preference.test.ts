import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  parseLocalePreference,
  resolveLocale,
} from "./locale-preference";

describe("parseLocalePreference", () => {
  it("accepts the system choice", () => {
    expect(parseLocalePreference("system")).toBe("system");
  });

  it("accepts an explicit supported locale", () => {
    expect(parseLocalePreference("en-US")).toBe("en-US");
  });

  it("fails closed to system on anything that is not a known value", () => {
    for (const value of ["de-DE", "fr", "", null, undefined, 42, {}, ["en-US"]]) {
      expect(parseLocalePreference(value)).toBe("system");
    }
  });
});

describe("resolveLocale", () => {
  it("returns an explicit supported locale as-is", () => {
    expect(resolveLocale("en-US", "de-DE")).toBe("en-US");
  });

  it("resolves system to the browser locale on exact match", () => {
    expect(resolveLocale("system", "en-US")).toBe("en-US");
  });

  it("resolves system to the browser locale on same-language match", () => {
    // No exact "en-GB" support, but the same language "en" is supported.
    expect(resolveLocale("system", "en-GB")).toBe("en-US");
  });

  it("falls back to the default locale when the browser locale matches nothing", () => {
    expect(resolveLocale("system", "de-DE")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("system", null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("system", undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("system", "")).toBe(DEFAULT_LOCALE);
  });

  it("fails closed to the default locale on a corrupt preference", () => {
    expect(resolveLocale("de-DE" as never, "fr-FR")).toBe(DEFAULT_LOCALE);
    expect(
      resolveLocale("" as never, undefined),
    ).toBe(DEFAULT_LOCALE);
  });
});
