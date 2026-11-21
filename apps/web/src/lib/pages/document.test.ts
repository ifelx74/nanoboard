import { describe, expect, it } from "vitest";
import {
  computePageStats,
  createEmptyPageContent,
  extractAssetIds,
  extractContentText,
  extractHeadings,
  extractPageImages,
  formatPageReadTime,
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

describe("extractHeadings", () => {
  it("returns an empty array for null, undefined, or documents with no headings", () => {
    expect(extractHeadings(undefined)).toEqual([]);
    expect(extractHeadings(null)).toEqual([]);
    expect(extractHeadings(createEmptyPageContent())).toEqual([]);
    expect(
      extractHeadings({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Just a paragraph." }],
          },
        ],
      }),
    ).toEqual([]);
  });

  it("extracts H1–H3 headings in document order, skips H4–H6 and empty headings, and traverses nested containers", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, id: "h-intro" },
          content: [
            { type: "text", text: "Project " },
            { type: "text", text: "Overview", marks: [{ type: "bold" }] },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2, id: "h-empty" },
          content: [{ type: "text", text: "   " }],
        },
        {
          type: "heading",
          attrs: { level: 2, id: "h-arch" },
          content: [{ type: "text", text: "Architecture" }],
        },
        {
          type: "heading",
          attrs: { level: 4, id: "h-ignored-4" },
          content: [{ type: "text", text: "Ignored H4" }],
        },
        {
          type: "heading",
          attrs: { level: 6, id: "h-ignored-6" },
          content: [{ type: "text", text: "Ignored H6" }],
        },
        {
          type: "callout",
          content: [
            {
              type: "heading",
              attrs: { level: 3, id: "h-nested" },
              content: [
                { type: "text", text: "Storage" },
                { type: "hardBreak" },
                { type: "text", text: "Details" },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Without Explicit ID" }],
        },
      ],
    };

    expect(extractHeadings(doc)).toEqual([
      { id: "h-intro", level: 1, text: "Project Overview" },
      { id: "h-arch", level: 2, text: "Architecture" },
      { id: "h-nested", level: 3, text: "Storage Details" },
      { id: "heading-4", level: 2, text: "Without Explicit ID" },
    ]);
  });
});

describe("formatPageReadTime", () => {
  it("formats zero, sub-minute seconds, and minute ceilings", () => {
    expect(formatPageReadTime(0)).toBe("0s");
    expect(formatPageReadTime(-5)).toBe("0s");
    expect(formatPageReadTime(Number.NaN)).toBe("0s");
    expect(formatPageReadTime(1)).toBe("1s");
    expect(formatPageReadTime(59)).toBe("59s");
    expect(formatPageReadTime(60)).toBe("1m");
    expect(formatPageReadTime(61)).toBe("2m");
    expect(formatPageReadTime(120)).toBe("2m");
  });
});

describe("computePageStats", () => {
  it("returns zeroed stats for null, undefined, and empty documents", () => {
    const expected = {
      words: 0,
      characters: 0,
      paragraphs: 0,
      readTimeSeconds: 0,
      readTimeMinutes: 0,
      readTimeLabel: "0s",
    };

    expect(computePageStats(undefined)).toEqual(expected);
    expect(computePageStats(null)).toEqual(expected);
    expect(computePageStats(createEmptyPageContent())).toEqual(expected);
    expect(
      computePageStats({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "   " }] },
        ],
      }),
    ).toEqual(expected);
  });

  it("counts words, characters, non-empty paragraphs, and read time across headings, lists, callouts, and tables", () => {
    // Blocks with text:
    // - heading: "Plan" (1 word, 4 chars, not a paragraph)
    // - paragraph: "Ship fast" (2 words, 9 chars, paragraph #1)
    // - empty paragraph (0 words, 0 chars, skipped)
    // - bulletList > listItem > paragraph: "Alpha beta" (2 words, 10 chars, paragraph #2)
    // - callout > paragraph: "Note" (1 word, 4 chars, paragraph #3)
    // - table > row > 2 cells: "Key" (1 word, 3 chars, paragraph #4), "Val" (1 word, 3 chars, paragraph #5)
    // Total: 8 words, 33 chars, 5 non-empty paragraphs, ceil(8 / 200 * 60) = ceil(2.4) = 3s
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, id: "h1" },
          content: [{ type: "text", text: "Plan" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ship " },
            { type: "text", text: "fast", marks: [{ type: "bold" }] },
          ],
        },
        { type: "paragraph" },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Alpha beta" }],
                },
              ],
            },
          ],
        },
        {
          type: "callout",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Note" }],
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
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Key" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Val" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(computePageStats(doc)).toEqual({
      words: 8,
      characters: 33,
      paragraphs: 5,
      readTimeSeconds: 3,
      readTimeMinutes: 1,
      readTimeLabel: "3s",
    });
  });

  it("computes read-time minutes cleanly across the 200 wpm boundary", () => {
    const makeDocWithWords = (count: number) => ({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: Array.from({ length: count }, () => "word").join(" "),
            },
          ],
        },
      ],
    });

    const stats100 = computePageStats(makeDocWithWords(100));
    expect(stats100.words).toBe(100);
    expect(stats100.readTimeSeconds).toBe(30);
    expect(stats100.readTimeMinutes).toBe(1);
    expect(stats100.readTimeLabel).toBe("30s");

    const stats200 = computePageStats(makeDocWithWords(200));
    expect(stats200.words).toBe(200);
    expect(stats200.readTimeSeconds).toBe(60);
    expect(stats200.readTimeMinutes).toBe(1);
    expect(stats200.readTimeLabel).toBe("1m");

    const stats250 = computePageStats(makeDocWithWords(250));
    expect(stats250.words).toBe(250);
    expect(stats250.readTimeSeconds).toBe(75);
    expect(stats250.readTimeMinutes).toBe(2);
    expect(stats250.readTimeLabel).toBe("2m");
  });
});

describe("extractPageImages", () => {
  it("returns an empty array for null, undefined, or documents with no populated images", () => {
    expect(extractPageImages(undefined)).toEqual([]);
    expect(extractPageImages(null)).toEqual([]);
    expect(extractPageImages(createEmptyPageContent())).toEqual([]);
    expect(
      extractPageImages({
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { id: "pending-1", assetId: null, src: null },
          },
          {
            type: "image",
            attrs: { id: "unsafe-1", src: "javascript:alert(1)" },
          },
          {
            type: "image",
            attrs: { id: "unsafe-2", src: "data:image/png;base64,AAAA" },
          },
        ],
      }),
    ).toEqual([]);
  });

  it("extracts local and external images in document order across top-level and nested blocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            id: "img-local-1",
            assetId: "asset-1",
            src: null,
            name: "architecture.webp",
            alt: "Architecture diagram",
          },
        },
        {
          type: "callout",
          content: [
            {
              type: "image",
              attrs: {
                id: "img-ext-1",
                assetId: null,
                src: "https://example.com/media/banner.png?v=2",
                name: null,
                alt: "",
              },
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "image",
                  attrs: {
                    assetId: "asset-1",
                    src: null,
                    name: null,
                    alt: "Reused diagram",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractPageImages(doc)).toEqual([
      {
        id: "img-local-1",
        anchorId: "image-img-local-1",
        assetId: "asset-1",
        src: null,
        name: "architecture.webp",
        alt: "Architecture diagram",
      },
      {
        id: "img-ext-1",
        anchorId: "image-img-ext-1",
        assetId: null,
        src: "https://example.com/media/banner.png?v=2",
        name: "banner.png",
        alt: "",
      },
      {
        id: "image-node-2",
        anchorId: null,
        assetId: "asset-1",
        src: null,
        name: "Reused diagram",
        alt: "Reused diagram",
      },
    ]);
  });
});
