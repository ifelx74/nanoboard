import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import {
  buildTestContents,
  createTestDb,
  makePage,
  makePageAsset,
  makePageContent,
  seedTestDb,
} from "../db/test-db";
import { buildPageMarkdown } from "./export-page";

describe("buildPageMarkdown", () => {
  it("inlines referenced local pageAssets as base64 data URLs in 'everything' mode, resolves emojis, and filters images in 'no-images' and 'copy' modes", async () => {
    const db = createTestDb();
    const localBlob = new Blob([new Uint8Array([137, 80, 78, 71])], {
      type: "image/png",
    });

    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            { type: "text", text: "Release Notes " },
            { type: "emoji", attrs: { name: "rocket" } },
          ],
        },
        {
          type: "image",
          attrs: {
            assetId: "asset-1",
            src: null,
            name: "screen.png",
            alt: "Screenshot",
          },
        },
        {
          type: "image",
          attrs: {
            assetId: null,
            src: "https://example.com/hero.png",
            name: "hero.png",
            alt: "Hero",
          },
        },
      ],
    };

    await seedTestDb(db, {
      ...buildTestContents(),
      pages: [makePage({ id: "page-1", projectId: "project-1" })],
      pageContents: [
        makePageContent({
          pageId: "page-1",
          projectId: "project-1",
          contentJson,
        }),
      ],
      pageAssets: [
        makePageAsset({
          id: "asset-1",
          pageId: "page-1",
          projectId: "project-1",
          name: "screen.png",
          mimeType: "image/png",
          blob: localBlob,
        }),
        makePageAsset({
          id: "asset-unused",
          pageId: "page-1",
          projectId: "project-1",
          name: "orphan.png",
          mimeType: "image/png",
          blob: new Blob(["unused"], { type: "image/png" }),
        }),
      ],
    });

    const everything = await buildPageMarkdown(
      db,
      "page-1",
      contentJson,
      "everything",
    );
    expect(everything).toBe(
      [
        "# Release Notes 🚀",
        "![Screenshot](data:image/png;base64,iVBORw==)",
        "![Hero](https://example.com/hero.png)",
      ].join("\n\n"),
    );

    const noImages = await buildPageMarkdown(
      db,
      "page-1",
      contentJson,
      "no-images",
    );
    expect(noImages).toBe("# Release Notes 🚀");

    const copy = await buildPageMarkdown(db, "page-1", contentJson, "copy");
    expect(copy).toBe(
      ["# Release Notes 🚀", "![Hero](https://example.com/hero.png)"].join(
        "\n\n",
      ),
    );
  });
});
