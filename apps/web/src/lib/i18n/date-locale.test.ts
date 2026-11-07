import { describe, expect, it } from "vitest";
import { getDateLocale } from "./date-locale";

describe("getDateLocale", () => {
  it("returns the date-fns locale matching the resolved en-US locale", () => {
    expect(getDateLocale("en-US").code).toBe("en-US");
  });

  it("falls back to the default date locale for anything unknown", () => {
    expect(getDateLocale("de-DE" as never).code).toBe("en-US");
  });
});
