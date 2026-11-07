import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  parseLocalePreference,
  parseStoredLocalePreference,
  resolveLocale,
} from "./locale-preference";

/** Build a zustand-persist envelope like the theme store writes. */
function envelope(locale: unknown): string {
  return JSON.stringify({ state: { locale }, version: 0 });
}

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

describe("parseStoredLocalePreference", () => {
  it("reads the locale out of the persist envelope", () => {
    expect(parseStoredLocalePreference(envelope("en-US"))).toBe("en-US");
    expect(parseStoredLocalePreference(envelope("system"))).toBe("system");
  });

  it("fails closed to system on missing, corrupt, or foreign envelopes", () => {
    expect(parseStoredLocalePreference(null)).toBe("system");
    expect(parseStoredLocalePreference(undefined)).toBe("system");
    expect(parseStoredLocalePreference("")).toBe("system");
    expect(parseStoredLocalePreference("{not json")).toBe("system");
    expect(parseStoredLocalePreference("42")).toBe("system");
    expect(parseStoredLocalePreference(JSON.stringify({ version: 0 }))).toBe(
      "system",
    );
    expect(parseStoredLocalePreference(JSON.stringify({ state: null }))).toBe(
      "system",
    );
    expect(parseStoredLocalePreference(envelope("de-DE"))).toBe("system");
    expect(parseStoredLocalePreference(envelope(null))).toBe("system");
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
