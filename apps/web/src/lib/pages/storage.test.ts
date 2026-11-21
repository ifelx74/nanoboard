import { describe, expect, it } from "vitest";
import { getDefaultPageStorage } from "./storage";

describe("getDefaultPageStorage", () => {
  it("returns null gracefully when localStorage is unavailable in plain Node", () => {
    const storage = getDefaultPageStorage();
    expect(storage === null || typeof storage.getItem === "function").toBe(
      true,
    );
  });

  it("returns null when accessing localStorage throws", () => {
    const throwingTarget = Object.defineProperty({}, "localStorage", {
      get() {
        throw new Error("SecurityError");
      },
    });
    expect(getDefaultPageStorage(throwingTarget)).toBeNull();
  });

  it("returns the storage object when present on the host", () => {
    const fakeStorage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(getDefaultPageStorage({ localStorage: fakeStorage })).toBe(
      fakeStorage,
    );
  });
});
