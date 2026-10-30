import { describe, expect, it } from "vitest";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Whiteboard } from "@/lib/db/schema";
import { decideWhiteboardPreview } from "./preview";

type ScenePayload = Pick<Whiteboard, "elements">;

/** Minimal element fixture; the rule only reads the payload's element list. */
function element(id: string): ExcalidrawElement {
  return { id, type: "rectangle" } as unknown as ExcalidrawElement;
}

describe("decideWhiteboardPreview", () => {
  it("publishes when the built payload holds at least one element", () => {
    const payload: ScenePayload = { elements: [element("rect-1")] };
    expect(decideWhiteboardPreview(payload)).toBe("publish");
  });

  it("removes when the built payload holds no elements", () => {
    const payload: ScenePayload = { elements: [] };
    expect(decideWhiteboardPreview(payload)).toBe("remove");
  });

  it("publishes only on element presence, regardless of appState or files", () => {
    // buildScenePayload hands over non-deleted elements only, so the verdict
    // is element presence alone — a payload with appState/files but nothing
    // drawn still removes the preview row.
    const drawn: ScenePayload & Pick<Whiteboard, "appState" | "files"> = {
      elements: [element("rect-1"), element("rect-2")],
      appState: { viewBackgroundColor: "#fefefe" },
      files: {},
    };
    expect(decideWhiteboardPreview(drawn)).toBe("publish");
    expect(decideWhiteboardPreview({ ...drawn, elements: [] })).toBe("remove");
  });
});
