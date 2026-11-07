import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "./locale-preference";
import { getLocaleLabel } from "./get-locale-label";

describe("getLocaleLabel", () => {
  it("labels every supported locale in its own language", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(getLocaleLabel(locale).trim().length).toBeGreaterThan(0);
    }
  });

  it("labels en-US as English (its own language)", () => {
    expect(getLocaleLabel("en-US")).toBe("English");
  });

  it("falls back to the locale code when the platform cannot label it", () => {
    expect(getLocaleLabel("not-a-locale")).toBe("not-a-locale");
  });
});
