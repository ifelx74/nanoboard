import { describe, expect, it, vi } from "vitest";
import {
  PAGE_IMAGE_COMPRESSION_QUALITY,
  PAGE_IMAGE_MAX_BYTES,
  PAGE_IMAGE_MAX_DIMENSION,
  PageImageValidationError,
  compressPageImage,
  computeTargetDimensions,
  deriveAssetFileName,
  deriveExternalImageFileName,
  isSupportedPageImageMimeType,
  validateExternalImageUrl,
  validatePageImageUpload,
} from "./image-upload";

describe("validatePageImageUpload", () => {
  it("accepts JPEG, PNG, WebP, and GIF files up to the 10 MB hard cap", () => {
    expect(PAGE_IMAGE_MAX_BYTES).toBe(10 * 1024 * 1024);

    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "IMAGE/PNG",
      " image/webp ",
    ]) {
      expect(isSupportedPageImageMimeType(mime)).toBe(true);
      expect(
        validatePageImageUpload({ type: mime, size: PAGE_IMAGE_MAX_BYTES }),
      ).toEqual({
        ok: true,
        mimeType: mime.trim().toLowerCase(),
      });
    }
  });

  it("rejects unsupported MIME types such as SVG, BMP, PDF, and empty MIME strings", () => {
    for (const badMime of [
      "image/svg+xml",
      "image/bmp",
      "image/tiff",
      "application/pdf",
      "text/plain",
      "",
    ]) {
      expect(isSupportedPageImageMimeType(badMime)).toBe(false);
      expect(validatePageImageUpload({ type: badMime, size: 1024 })).toEqual({
        ok: false,
        code: "unsupported-type",
      });
    }
  });

  it("rejects files larger than 10 MB and empty or invalid sizes", () => {
    expect(
      validatePageImageUpload({
        type: "image/png",
        size: PAGE_IMAGE_MAX_BYTES + 1,
      }),
    ).toEqual({
      ok: false,
      code: "file-too-large",
    });

    expect(validatePageImageUpload({ type: "image/png", size: 0 })).toEqual({
      ok: false,
      code: "empty-file",
    });
    expect(validatePageImageUpload({ type: "image/png", size: -5 })).toEqual({
      ok: false,
      code: "empty-file",
    });
    expect(
      validatePageImageUpload({ type: "image/png", size: Number.NaN }),
    ).toEqual({
      ok: false,
      code: "empty-file",
    });
  });
});

describe("validateExternalImageUrl", () => {
  it("accepts valid http and https image URLs after trimming", () => {
    expect(validateExternalImageUrl("https://example.com/diagram.png")).toBe(
      "https://example.com/diagram.png",
    );
    expect(
      validateExternalImageUrl(
        "  http://localhost:8080/assets/photo.webp?v=2  ",
      ),
    ).toBe("http://localhost:8080/assets/photo.webp?v=2");
    expect(validateExternalImageUrl("HTTPS://cdn.example.org/a/b.jpg#1")).toBe(
      "HTTPS://cdn.example.org/a/b.jpg#1",
    );
  });

  it("rejects dangerous protocols, data/blob URLs, relative paths, and malformed inputs", () => {
    for (const bad of [
      "",
      "   ",
      "photo.png",
      "/images/local.png",
      "javascript:alert(1)",
      "\tjava\nscript:alert(1)",
      "data:image/png;base64,iVBORw0KGgo=",
      "blob:https://example.com/1234",
      "file:///etc/passwd",
      "ftp://example.com/img.png",
      "mailto:test@example.com",
      "https://example.com/has space.png",
      "https://nodot/img.png",
      "https://.leadingdot.com/img.png",
    ]) {
      expect(validateExternalImageUrl(bad)).toBeNull();
    }
  });
});

describe("computeTargetDimensions", () => {
  it("preserves dimensions already within the 1920px longest-edge limit", () => {
    expect(PAGE_IMAGE_MAX_DIMENSION).toBe(1920);
    expect(computeTargetDimensions(1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
      resized: false,
    });
    expect(computeTargetDimensions(800, 600)).toEqual({
      width: 800,
      height: 600,
      resized: false,
    });
  });

  it("downscales landscape and portrait images proportionally to 1920px longest edge", () => {
    expect(computeTargetDimensions(3840, 2160)).toEqual({
      width: 1920,
      height: 1080,
      resized: true,
    });
    expect(computeTargetDimensions(1500, 3000)).toEqual({
      width: 960,
      height: 1920,
      resized: true,
    });
  });
});

describe("filename derivation helpers", () => {
  it("derives clean local asset filenames and swaps extension when re-encoded", () => {
    expect(deriveAssetFileName("diagram.png", "image/webp")).toBe(
      "diagram.webp",
    );
    expect(deriveAssetFileName("photo.JPEG", "image/jpeg")).toBe("photo.jpg");
    expect(deriveAssetFileName("anim.gif", "image/gif")).toBe("anim.gif");
    expect(deriveAssetFileName("", "image/png")).toBe("image.png");
    expect(deriveAssetFileName("screenshot", "image/webp")).toBe(
      "screenshot.webp",
    );
  });

  it("derives clean filenames from external image URLs with fallback", () => {
    expect(
      deriveExternalImageFileName(
        "https://cdn.example.com/assets/hero.png?w=800",
      ),
    ).toBe("hero.png");
    expect(
      deriveExternalImageFileName("https://cdn.example.com/my%20diagram.webp"),
    ).toBe("my diagram.webp");
    expect(deriveExternalImageFileName("https://example.com/")).toBe("image");
  });
});

describe("compressPageImage", () => {
  it("rejects unsupported MIME types and >10 MB uploads before transcoding", async () => {
    const transcoder = vi.fn();

    await expect(
      compressPageImage(new Blob(["<svg/>"], { type: "image/svg+xml" }), {
        name: "bad.svg",
        transcodeRaster: transcoder,
      }),
    ).rejects.toMatchObject({
      name: "PageImageValidationError",
      code: "unsupported-type",
    });

    const oversize = new Blob([new Uint8Array(PAGE_IMAGE_MAX_BYTES + 1)], {
      type: "image/png",
    });
    await expect(
      compressPageImage(oversize, {
        name: "huge.png",
        transcodeRaster: transcoder,
      }),
    ).rejects.toBeInstanceOf(PageImageValidationError);

    expect(transcoder).not.toHaveBeenCalled();
  });

  it("preserves animated GIFs unmodified without calling the raster transcoder", async () => {
    const gifBlob = new Blob(["GIF89a-fake-frames"], { type: "image/gif" });
    const transcoder = vi.fn();

    const result = await compressPageImage(gifBlob, {
      name: "party.gif",
      transcodeRaster: transcoder,
    });

    expect(transcoder).not.toHaveBeenCalled();
    expect(result.blob).toBe(gifBlob);
    expect(result.mimeType).toBe("image/gif");
    expect(result.name).toBe("party.gif");
    expect(result.compressed).toBe(false);
  });

  it("compresses raster images to WebP at 0.82 quality and returns smaller bytes with updated name", async () => {
    const original = new Blob([new Uint8Array(4000)], { type: "image/png" });
    const smallerWebp = new Blob([new Uint8Array(1200)], {
      type: "image/webp",
    });

    const result = await compressPageImage(original, {
      name: "architecture.png",
      transcodeRaster: async (_blob, options) => {
        expect(options.maxDimension).toBe(1920);
        expect(options.quality).toBe(PAGE_IMAGE_COMPRESSION_QUALITY);
        return {
          blob: smallerWebp,
          mimeType: "image/webp",
          width: 1920,
          height: 1080,
        };
      },
    });

    expect(result.blob).toBe(smallerWebp);
    expect(result.mimeType).toBe("image/webp");
    expect(result.name).toBe("architecture.webp");
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.compressed).toBe(true);
  });

  it("falls back to original bytes when compressed output is not smaller", async () => {
    const original = new Blob([new Uint8Array(500)], { type: "image/png" });
    const largerWebp = new Blob([new Uint8Array(900)], { type: "image/webp" });

    const result = await compressPageImage(original, {
      name: "tiny-icon.png",
      transcodeRaster: async () => ({
        blob: largerWebp,
        mimeType: "image/webp",
        width: 64,
        height: 64,
      }),
    });

    expect(result.blob).toBe(original);
    expect(result.mimeType).toBe("image/png");
    expect(result.name).toBe("tiny-icon.png");
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.compressed).toBe(false);
  });

  it("keeps original bytes safely when raster transcoding fails", async () => {
    const original = new Blob([new Uint8Array(1024)], { type: "image/jpeg" });

    const result = await compressPageImage(original, {
      name: "photo.jpg",
      transcodeRaster: async () => {
        throw new Error("Canvas unavailable");
      },
    });

    expect(result.blob).toBe(original);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.name).toBe("photo.jpg");
    expect(result.compressed).toBe(false);
  });
});
