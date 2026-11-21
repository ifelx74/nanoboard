import { describe, expect, it } from "vitest";
import {
  createEmptyPageContent,
  extractAssetIds,
  extractContentText,
  rewriteAssetIds,
} from "./document";

describe("createEmptyPageContent", () => {
  it("returns a fresh empty TipTap document with one empty paragraph", () => {
    const first = createEmptyPageContent();
    const second = createEmptyPageContent();

    expect(first).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    expect(first).not.toBe(second);
    expect(first.content).not.toBe(second.content);
  });
});

describe("extractContentText", () => {
  it("returns an empty string for empty, null, or undefined documents", () => {
    expect(extractContentText(undefined)).toBe("");
    expect(extractContentText(null)).toBe("");
    expect(extractContentText({ type: "doc" })).toBe("");
    expect(extractContentText(createEmptyPageContent())).toBe("");
  });

  it("concatenates inline text segments without splitting marked words and preserves hard breaks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: "world" },
            { type: "hardBreak" },
            { type: "text", text: "second line" },
          ],
        },
      ],
    };

    expect(extractContentText(doc)).toBe("Hello boldworld\nsecond line");
  });

  it("separates headings, paragraphs, blockquotes, and code blocks with newlines while skipping empty blocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Architecture" }],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Local-first IndexedDB storage." }],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "No backend required." }],
            },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const x = 1;\nconst y = 2;" }],
        },
      ],
    };

    expect(extractContentText(doc)).toBe(
      "Architecture\nLocal-first IndexedDB storage.\nNo backend required.\nconst x = 1;\nconst y = 2;",
    );
  });

  it("extracts nested lists, task lists, callouts, and table cells while ignoring non-text nodes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Parent item" }],
                },
                {
                  type: "taskList",
                  content: [
                    {
                      type: "taskItem",
                      attrs: { checked: true },
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested check" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { type: "horizontalRule" },
        { type: "image", attrs: { src: "https://example.com/a.png" } },
        {
          type: "callout",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Heads up!" }],
            },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Name" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Status" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Pages" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Done" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractContentText(doc)).toBe(
      "Parent item\nNested check\nHeads up!\nName Status\nPages Done",
    );
  });
});

describe("extractAssetIds", () => {
  it("returns an empty set for null, undefined, or documents without local assets", () => {
    expect(extractAssetIds(undefined)).toEqual(new Set());
    expect(extractAssetIds(null)).toEqual(new Set());
    expect(extractAssetIds(createEmptyPageContent())).toEqual(new Set());
    expect(
      extractAssetIds({
        type: "doc",
        content: [
          { type: "image", attrs: { src: "https://example.com/pic.png" } },
          { type: "image", attrs: { assetId: "" } },
          { type: "image", attrs: { assetId: null } },
        ],
      }),
    ).toEqual(new Set());
  });

  it("collects unique local assetIds across top-level and deeply nested blocks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "image", attrs: { assetId: "asset-1", alt: "Top" } },
        {
          type: "callout",
          content: [
            {
              type: "image",
              attrs: { assetId: "asset-2", alignment: "center" },
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "image",
                      attrs: { assetId: "asset-1", width: "50%" },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    { type: "customImage", attrs: { assetId: "asset-3" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractAssetIds(doc)).toEqual(
      new Set(["asset-1", "asset-2", "asset-3"]),
    );
  });
});

describe("rewriteAssetIds", () => {
  it("rewrites mapped assetIds recursively while preserving other attributes, marks, external images, and immutability", () => {
    const source = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Diagram",
              marks: [{ type: "bold" }],
            },
          ],
        },
        {
          type: "image",
          attrs: {
            id: "node-1",
            assetId: "asset-1",
            width: "40%",
            alignment: "center",
          },
        },
        {
          type: "image",
          attrs: {
            src: "https://example.com/ext.png",
            alt: "External",
          },
        },
        {
          type: "callout",
          attrs: { backgroundColor: "peach" },
          content: [
            {
              type: "image",
              attrs: { assetId: "asset-1", alt: "Duplicate ref" },
            },
            {
              type: "image",
              attrs: { assetId: "asset-unmapped", alt: "Unmapped" },
            },
          ],
        },
      ],
    };

    const rewritten = rewriteAssetIds(
      source,
      new Map([["asset-1", "asset-new-1"]]),
    );

    expect(rewritten).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Diagram",
              marks: [{ type: "bold" }],
            },
          ],
        },
        {
          type: "image",
          attrs: {
            id: "node-1",
            assetId: "asset-new-1",
            width: "40%",
            alignment: "center",
          },
        },
        {
          type: "image",
          attrs: {
            src: "https://example.com/ext.png",
            alt: "External",
          },
        },
        {
          type: "callout",
          attrs: { backgroundColor: "peach" },
          content: [
            {
              type: "image",
              attrs: { assetId: "asset-new-1", alt: "Duplicate ref" },
            },
            {
              type: "image",
              attrs: { assetId: "asset-unmapped", alt: "Unmapped" },
            },
          ],
        },
      ],
    });

    // Source tree must remain completely untouched and decoupled.
    expect(source.content[1]?.attrs?.assetId).toBe("asset-1");
    expect(rewritten).not.toBe(source);
    expect(rewritten.content).not.toBe(source.content);
    expect(rewritten.content?.[1]?.attrs).not.toBe(source.content[1]?.attrs);
  });

  it("also accepts a plain record mapping", () => {
    const doc = {
      type: "doc",
      content: [{ type: "image", attrs: { assetId: "old-a" } }],
    };

    expect(rewriteAssetIds(doc, { "old-a": "new-a" })).toEqual({
      type: "doc",
      content: [{ type: "image", attrs: { assetId: "new-a" } }],
    });
  });
});
