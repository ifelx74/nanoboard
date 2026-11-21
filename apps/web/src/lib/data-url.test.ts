import { describe, expect, it } from "vitest";
import { blobToDataUrl, dataUrlToBlob, isValidBase64DataUrl } from "./data-url";

describe("data-url helpers", () => {
  it("round-trips binary bytes (0x00..0xFF) byte-for-byte through Blob ↔ dataUrl", async () => {
    const originalBytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const originalBlob = new Blob([originalBytes], { type: "image/png" });

    const dataUrl = await blobToDataUrl(originalBlob);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(isValidBase64DataUrl(dataUrl)).toBe(true);

    const restoredBlob = dataUrlToBlob(dataUrl);
    expect(restoredBlob.type).toBe("image/png");
    expect(restoredBlob.size).toBe(originalBytes.length);
    const restoredBytes = new Uint8Array(await restoredBlob.arrayBuffer());
    expect(restoredBytes).toEqual(originalBytes);
  });

  it("round-trips empty blobs and multi-chunk (>32 KB) binary payloads", async () => {
    const emptyBlob = new Blob([], { type: "image/webp" });
    const emptyUrl = await blobToDataUrl(emptyBlob);
    expect(emptyUrl).toBe("data:image/webp;base64,");
    expect(isValidBase64DataUrl(emptyUrl)).toBe(true);

    const restoredEmpty = dataUrlToBlob(emptyUrl);
    expect(restoredEmpty.type).toBe("image/webp");
    expect(restoredEmpty.size).toBe(0);

    const largeBytes = Uint8Array.from(
      { length: 70_000 },
      (_, i) => (i * 31) & 0xff,
    );
    const largeBlob = new Blob([largeBytes], { type: "image/jpeg" });
    const largeUrl = await blobToDataUrl(largeBlob);
    const restoredLarge = dataUrlToBlob(largeUrl);
    expect(restoredLarge.type).toBe("image/jpeg");
    expect(new Uint8Array(await restoredLarge.arrayBuffer())).toEqual(
      largeBytes,
    );
  });

  it("uses mimeTypeFallback when Blob.type is empty", async () => {
    const untyped = new Blob([new Uint8Array([1, 2, 3])]);
    const url = await blobToDataUrl(untyped, "image/gif");
    expect(url).toBe("data:image/gif;base64,AQID");

    const fallbackUrl = await blobToDataUrl(untyped);
    expect(fallbackUrl).toBe("data:application/octet-stream;base64,AQID");
  });

  it.each([
    ["non-string", 42],
    ["empty string", ""],
    ["plain https url", "https://example.com/a.png"],
    ["missing base64 marker", "data:image/png,hello"],
    ["missing mime subtype", "data:image;base64,AQID"],
    ["invalid base64 chars", "data:image/png;base64,not*valid!"],
    ["unpadded base64 length", "data:image/png;base64,ABC"],
    ["excessive padding", "data:image/png;base64,A==="],
    ["padding in middle", "data:image/png;base64,AB=C"],
  ])("rejects malformed dataUrl (%s)", (_label, value) => {
    expect(isValidBase64DataUrl(value)).toBe(false);
    if (typeof value === "string") {
      expect(() => dataUrlToBlob(value)).toThrow(/invalid base64 data url/i);
    }
  });
});
