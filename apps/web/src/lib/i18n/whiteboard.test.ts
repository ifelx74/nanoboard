import { describe, expect, it } from "vitest";
import enUS from "./locales/en-US.json";

describe("whiteboard extraction (ticket 12)", () => {
  it("covers gallery header and list-heading copy", () => {
    const whiteboard = enUS.whiteboard as unknown as Record<
      string,
      Record<string, unknown>
    >;
    expect(whiteboard.header?.title).toBe("Whiteboard");
    expect(whiteboard.gallery?.recentlyModified).toBe("Recently modified");
  });

  it("covers the gallery empty state and back-home action", () => {
    const whiteboard = enUS.whiteboard as unknown as Record<
      string,
      Record<string, unknown>
    >;
    expect(whiteboard.emptyState?.title).toBe(
      "Nothing on the whiteboard yet.",
    );
    expect(whiteboard.emptyState?.description).toBe(
      "Boards appear here once you draw something in a project's Whiteboard view.",
    );
    expect(whiteboard.emptyState?.backToHome).toBe("Back to Home");
  });

  it("covers canvas welcome and fullscreen copy", () => {
    const whiteboard = enUS.whiteboard as unknown as Record<
      string,
      Record<string, unknown>
    >;
    expect(whiteboard.canvas?.welcome).toBe("Welcome to the Whiteboard");
    expect(whiteboard.canvas?.enterFullscreen).toBe("Enter fullscreen");
    expect(whiteboard.canvas?.exitFullscreen).toBe("Exit fullscreen");
  });
});
