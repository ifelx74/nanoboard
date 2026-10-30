import { describe, expect, it, vi } from "vitest";
import { exportToBlob, getDataURL } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Whiteboard } from "@/lib/db/schema";
import {
  renderWhiteboardThumbnail,
  resolveThumbnailDataUrl,
  thumbnailAppState,
} from "./thumbnail";

// The node test environment has no canvas and the package's browser bundle
// does not even evaluate here (JSON import attribute error), so the Excalidraw
// runtime is replaced wholesale at the module boundary. MIME constants are
// copied from the installed package (MIME_TYPES.jpg === "image/jpeg").
vi.mock("@excalidraw/excalidraw", () => ({
  exportToBlob: vi.fn(),
  getDataURL: vi.fn(),
  MIME_TYPES: { jpg: "image/jpeg" },
}));

describe("resolveThumbnailDataUrl", () => {
  const PRIOR = "data:image/jpeg;base64,OLD";

  it("stores the freshly rendered thumbnail", () => {
    expect(
      resolveThumbnailDataUrl("data:image/jpeg;base64,NEW", PRIOR),
    ).toBe("data:image/jpeg;base64,NEW");
  });

  it("keeps the prior thumbnail when the render failed", () => {
    // A failed render must never clobber the row's existing thumbnail with
    // garbage or an empty string — the board keeps showing what it showed.
    expect(resolveThumbnailDataUrl(null, PRIOR)).toBe(PRIOR);
  });

  it("falls back to the empty placeholder when a failed render has no prior row", () => {
    // First-ever save whose render failed: the row still publishes (it doubles
    // as the has-content index) but carries the empty placeholder data URL.
    expect(resolveThumbnailDataUrl(null, undefined)).toBe("");
  });
});

describe("renderWhiteboardThumbnail", () => {
  const THUMB = "data:image/jpeg;base64,THUMB";

  function payloadFixture(
    overrides: Partial<Whiteboard> = {},
  ): Pick<Whiteboard, "elements" | "appState" | "files"> {
    return {
      elements: [
        { id: "rect-1", type: "rectangle" },
      ] as unknown as ExcalidrawElement[],
      appState: { viewBackgroundColor: "#aabbcc" },
      files: {
        "file-1": {
          mimeType: "image/png",
          id: "file-1" as never,
          dataURL: "data:image/png;base64,IMG" as never,
          created: 0,
        },
      } as unknown as BinaryFiles,
      ...overrides,
    };
  }

  it("rejects for a degenerate empty scene without invoking the export machinery", async () => {
    await expect(
      renderWhiteboardThumbnail(payloadFixture({ elements: [] })),
    ).rejects.toThrow(/empty/i);
    expect(exportToBlob).not.toHaveBeenCalled();
  });

  it("renders the payload to a capped JPEG data URL", async () => {
    const payload = payloadFixture();
    const blob = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
    vi.mocked(exportToBlob).mockResolvedValue(blob);
    vi.mocked(getDataURL).mockResolvedValue(
      THUMB as Awaited<ReturnType<typeof getDataURL>>,
    );

    const dataUrl = await renderWhiteboardThumbnail(payload);

    expect(dataUrl).toBe(THUMB);
    expect(exportToBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: payload.elements,
        files: payload.files,
        maxWidthOrHeight: 640,
        mimeType: "image/jpeg",
        quality: 0.8,
        appState: expect.objectContaining({
          viewBackgroundColor: "#aabbcc",
          exportBackground: true,
          exportWithDarkMode: false,
          exportScale: 1,
          frameRendering: {
            enabled: false,
            clip: false,
            name: false,
            outline: false,
          },
        }),
      }),
    );
  });

  it("propagates export failure to the caller", async () => {
    vi.mocked(exportToBlob).mockRejectedValue(
      new Error("couldn't export to blob"),
    );

    await expect(renderWhiteboardThumbnail(payloadFixture())).rejects.toThrow(
      "couldn't export to blob",
    );
  });
});

describe("thumbnailAppState", () => {
  it("assembles theme-stable export state that paints the board's own background", () => {
    // Persisted state as it might come from buildScenePayload: the board's
    // own canvas background, and hostile export prefs a user may have set
    // (dark export, transparent background, HiDPI scale).
    const persisted: Partial<AppState> = {
      viewBackgroundColor: "#aabbcc",
      exportBackground: false,
      exportWithDarkMode: true,
      exportScale: 3,
    };

    const assembled = thumbnailAppState(persisted);

    expect(assembled.viewBackgroundColor).toBe("#aabbcc");
    expect(assembled.exportBackground).toBe(true);
    expect(assembled.exportWithDarkMode).toBe(false);
    expect(assembled.exportScale).toBe(1);
    expect(assembled.frameRendering).toEqual({
      enabled: false,
      clip: false,
      name: false,
      outline: false,
    });
  });

  it("does not mutate the persisted appState", () => {
    const persisted: Partial<AppState> = {
      viewBackgroundColor: "#123456",
      exportWithDarkMode: true,
    };

    thumbnailAppState(persisted);

    expect(persisted.exportWithDarkMode).toBe(true);
    expect(persisted.exportBackground).toBeUndefined();
    expect(persisted.exportScale).toBeUndefined();
  });
});
