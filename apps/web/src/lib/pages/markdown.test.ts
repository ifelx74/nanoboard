import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import {
  blobToDataUrl,
  sanitizeMarkdownFileName,
  serializePageToMarkdown,
} from "./markdown";

describe("serializePageToMarkdown", () => {
  it("returns empty string for null, undefined, or empty documents", () => {
    expect(serializePageToMarkdown(null)).toBe("");
    expect(serializePageToMarkdown(undefined)).toBe("");
    expect(serializePageToMarkdown({ type: "doc", content: [] })).toBe("");
    expect(
      serializePageToMarkdown({
        type: "doc",
        content: [{ type: "paragraph" }],
      }),
    ).toBe("");
  });

  it("serializes paragraphs, headings H1–H6, hard breaks, and horizontal rules", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, id: "h1", textAlign: "center" },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Section" }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Sub" }],
        },
        {
          type: "heading",
          attrs: { level: 4 },
          content: [{ type: "text", text: "H4" }],
        },
        {
          type: "heading",
          attrs: { level: 5 },
          content: [{ type: "text", text: "H5" }],
        },
        {
          type: "heading",
          attrs: { level: 6 },
          content: [{ type: "text", text: "H6" }],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "right" },
          content: [
            { type: "text", text: "Line one" },
            { type: "hardBreak" },
            { type: "text", text: "Line two" },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [{ type: "text", text: "After divider." }],
        },
      ],
    };

    expect(serializePageToMarkdown(doc)).toBe(
      [
        "# Title",
        "## Section",
        "### Sub",
        "#### H4",
        "##### H5",
        "###### H6",
        "Line one  \nLine two",
        "---",
        "After divider.",
      ].join("\n\n"),
    );
  });

  it("serializes inline marks (bold, italic, strike, code, link) and handles edge cases", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: ", " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
            { type: "text", text: ", " },
            { type: "text", text: "struck", marks: [{ type: "strike" }] },
            { type: "text", text: ", " },
            {
              type: "text",
              text: "all three",
              marks: [{ type: "bold" }, { type: "italic" }, { type: "strike" }],
            },
            { type: "text", text: ", " },
            {
              type: "text",
              text: "inline `code`",
              marks: [{ type: "code" }],
            },
            { type: "text", text: ", and " },
            {
              type: "text",
              text: "Nanoboard",
              marks: [
                { type: "bold" },
                { type: "link", attrs: { href: "https://example.com/a_(b)" } },
              ],
            },
            { type: "text", text: "." },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: " spaced ",
              marks: [{ type: "bold" }],
            },
            {
              type: "text",
              text: "and ",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
            {
              type: "text",
              text: "styled link",
              marks: [
                { type: "italic" },
                { type: "link", attrs: { href: "https://example.com" } },
              ],
            },
          ],
        },
      ],
    };

    expect(serializePageToMarkdown(doc)).toBe(
      [
        "Hello **bold**, *italic*, ~~struck~~, ~~***all three***~~, `` inline `code` ``, and [**Nanoboard**](<https://example.com/a_(b)>).",
        " **spaced** [and *styled link*](https://example.com)",
      ].join("\n\n"),
    );
  });

  it("degrades underline, pageColor, and textStyle cleanly without dropping text or splitting bold runs", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Underlined ",
              marks: [{ type: "underline" }],
            },
            {
              type: "text",
              text: "colored ",
              marks: [
                {
                  type: "pageColor",
                  attrs: { color: "peach", backgroundColor: "green" },
                },
              ],
            },
            {
              type: "text",
              text: "styled ",
              marks: [{ type: "textStyle", attrs: { color: "#ff0000" } }],
            },
            {
              type: "text",
              text: "foo",
              marks: [
                { type: "bold" },
                { type: "pageColor", attrs: { color: "purple" } },
              ],
            },
            {
              type: "text",
              text: "bar",
              marks: [
                { type: "bold" },
                { type: "underline" },
                { type: "pageColor", attrs: { backgroundColor: "orange" } },
              ],
            },
          ],
        },
      ],
    };

    expect(serializePageToMarkdown(doc)).toBe(
      "Underlined colored styled **foobar**",
    );
  });

  it("resolves inline emoji nodes via resolveEmoji with :name: fallback", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ship it " },
            { type: "emoji", attrs: { name: "rocket" } },
            { type: "text", text: " " },
            { type: "emoji", attrs: { name: "unknown_custom" } },
          ],
        },
      ],
    };

    const lookup = (name: string) => (name === "rocket" ? "🚀" : undefined);
    expect(serializePageToMarkdown(doc, { resolveEmoji: lookup })).toBe(
      "Ship it 🚀 :unknown_custom:",
    );
    expect(serializePageToMarkdown(doc)).toBe(
      "Ship it :rocket: :unknown_custom:",
    );
  });

  it("serializes blockquotes including nested paragraphs and quotes", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "First quote line." }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Second quote line." }],
            },
            {
              type: "blockquote",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Nested quote." }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(serializePageToMarkdown(doc)).toBe(
      [
        "> First quote line.",
        ">",
        "> Second quote line.",
        ">",
        "> > Nested quote.",
      ].join("\n"),
    );
  });

  it("degrades callout blocks into readable emoji/icon-prefixed blockquotes", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: {
            logoType: "emoji",
            emoji: "💡",
            iconName: null,
            iconColor: null,
            backgroundColor: "light-blue",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Keep backups local." }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Zero server required." }],
            },
          ],
        },
        {
          type: "callout",
          attrs: {
            logoType: "icon",
            emoji: "💡",
            iconName: "AlertTriangle",
            iconColor: "#f59e0b",
            backgroundColor: "orange",
          },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Watch the bundle budget." }],
            },
          ],
        },
        {
          type: "callout",
          attrs: {
            logoType: "emoji",
            emoji: "🔥",
            iconName: null,
            iconColor: null,
            backgroundColor: null,
          },
          content: [
            {
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: "Checklist" }],
            },
          ],
        },
      ],
    };

    expect(serializePageToMarkdown(doc)).toBe(
      [
        "> 💡 Keep backups local.\n>\n> Zero server required.",
        "> **[Alert Triangle]** Watch the bundle budget.",
        "> 🔥\n>\n> ### Checklist",
      ].join("\n\n"),
    );
  });

  it("serializes fenced code blocks with language tags and escapes backtick fence collisions", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const total: number = 42;" }],
        },
        {
          type: "codeBlock",
          attrs: { language: null },
          content: [{ type: "text", text: "plain snippet" }],
        },
        {
          type: "codeBlock",
          attrs: { language: "markdown" },
          content: [
            {
              type: "text",
              text: "```ts\nconsole.log('nested fence');\n```",
            },
          ],
        },
      ],
    };

    expect(serializePageToMarkdown(doc)).toBe(
      [
        "```ts\nconst total: number = 42;\n```",
        "```\nplain snippet\n```",
        "````markdown\n```ts\nconsole.log('nested fence');\n```\n````",
      ].join("\n\n"),
    );
  });

  it("serializes nested bullet, ordered, and task lists including multi-block items", () => {
    const doc: JSONContent = {
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
                  content: [{ type: "text", text: "Top bullet" }],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested bullet" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Second bullet" }],
                },
                {
                  type: "codeBlock",
                  attrs: { language: "sh" },
                  content: [{ type: "text", text: "pnpm test" }],
                },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Step three" }],
                },
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Sub-step one" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Step four" }],
                },
              ],
            },
          ],
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
                  content: [{ type: "text", text: "Write serializer" }],
                },
                {
                  type: "taskList",
                  content: [
                    {
                      type: "taskItem",
                      attrs: { checked: false },
                      content: [
                        {
                          type: "paragraph",
                          content: [
                            { type: "text", text: "Wire export modal" },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(serializePageToMarkdown(doc)).toBe(
      [
        [
          "- Top bullet",
          "  - Nested bullet",
          "- Second bullet",
          "",
          "  ```sh",
          "  pnpm test",
          "  ```",
        ].join("\n"),
        ["3. Step three", "   1. Sub-step one", "4. Step four"].join("\n"),
        ["- [x] Write serializer", "  - [ ] Wire export modal"].join("\n"),
      ].join("\n\n"),
    );
  });

  it("serializes tables into valid GFM pipe tables, escaping pipes and collapsing cell newlines", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
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
                      content: [{ type: "text", text: "Feature" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Syntax | Notes" }],
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
                      content: [
                        {
                          type: "text",
                          text: "a | b",
                          marks: [{ type: "code" }],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Line 1" },
                        { type: "hardBreak" },
                        { type: "text", text: "Line 2" },
                      ],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Para 2" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(serializePageToMarkdown(doc)).toBe(
      [
        "| Feature | Syntax \\| Notes |",
        "| --- | --- |",
        "| `a \\| b` | Line 1 Line 2 Para 2 |",
      ].join("\n"),
    );
  });

  it("handles local and external images across 'everything', 'no-images', and 'copy' modes", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Intro" }],
        },
        {
          type: "image",
          attrs: {
            id: "img-1",
            assetId: "asset-local-1",
            src: null,
            name: "diagram.webp",
            alt: "Architecture [v1]",
            width: "50%",
            alignment: "center",
            aspectRatio: 1.5,
          },
        },
        {
          type: "image",
          attrs: {
            id: "img-2",
            assetId: null,
            src: "https://cdn.example.com/banner.png",
            name: "banner.png",
            alt: "",
            width: "75%",
            alignment: "right",
            aspectRatio: 2,
          },
        },
        {
          type: "image",
          attrs: {
            id: "img-pending",
            assetId: null,
            src: null,
            name: null,
            alt: "",
          },
        },
        {
          type: "image",
          attrs: {
            id: "img-missing",
            assetId: "asset-missing",
            src: null,
            name: "missing.png",
            alt: "Missing",
          },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Outro" }],
        },
      ],
    };

    const assetDataUrls = new Map([
      ["asset-local-1", "data:image/webp;base64,UklGRh4AAABXRUJQ"],
    ]);

    expect(
      serializePageToMarkdown(doc, {
        imageMode: "everything",
        assetDataUrls,
      }),
    ).toBe(
      [
        "Intro",
        "![Architecture \\[v1\\]](data:image/webp;base64,UklGRh4AAABXRUJQ)",
        "![banner.png](https://cdn.example.com/banner.png)",
        "Outro",
      ].join("\n\n"),
    );

    expect(
      serializePageToMarkdown(doc, {
        imageMode: "no-images",
        assetDataUrls,
      }),
    ).toBe(["Intro", "Outro"].join("\n\n"));

    expect(
      serializePageToMarkdown(doc, {
        imageMode: "copy",
        assetDataUrls,
      }),
    ).toBe(
      [
        "Intro",
        "![banner.png](https://cdn.example.com/banner.png)",
        "Outro",
      ].join("\n\n"),
    );

    // Default imageMode is "copy"
    expect(serializePageToMarkdown(doc, { assetDataUrls })).toBe(
      [
        "Intro",
        "![banner.png](https://cdn.example.com/banner.png)",
        "Outro",
      ].join("\n\n"),
    );
  });

  it("preserves text inside unknown container nodes and escapes special inline characters", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "customContainer",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Kept text with *stars* and [brackets]" },
              ],
            },
          ],
        },
      ],
    };

    expect(serializePageToMarkdown(doc)).toBe(
      "Kept text with \\*stars\\* and \\[brackets\\]",
    );
  });

  it("serializes a full combined document cleanly across all supported nodes and marks", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, textAlign: "left" },
          content: [
            { type: "text", text: "Nanoboard Spec " },
            { type: "emoji", attrs: { name: "sparkles" } },
          ],
        },
        {
          type: "callout",
          attrs: {
            logoType: "emoji",
            emoji: "💡",
            iconName: null,
            iconColor: null,
            backgroundColor: "green",
          },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "All data stays " },
                {
                  type: "text",
                  text: "local-first",
                  marks: [
                    { type: "bold" },
                    { type: "underline" },
                    { type: "pageColor", attrs: { color: "green" } },
                  ],
                },
                { type: "text", text: " in IndexedDB." },
              ],
            },
          ],
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
                  content: [
                    { type: "text", text: "Run " },
                    {
                      type: "text",
                      text: "pnpm test",
                      marks: [
                        { type: "code" },
                        {
                          type: "link",
                          attrs: { href: "https://example.com/ci" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Ship v1" }],
                },
              ],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "image",
              attrs: {
                assetId: "only-local",
                src: null,
                name: "only-local.png",
                alt: "Only local",
              },
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
                  attrs: { colspan: 2 },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Budget" }],
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
                      content: [{ type: "text", text: "JS" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "<= 240 kB" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "codeBlock",
          attrs: { language: "json" },
          content: [],
        },
      ],
    };

    expect(
      serializePageToMarkdown(doc, {
        imageMode: "copy",
        resolveEmoji: (name) => (name === "sparkles" ? "✨" : undefined),
      }),
    ).toBe(
      [
        "# Nanoboard Spec ✨",
        "> 💡 All data stays **local-first** in IndexedDB.",
        "- [x] Run [`pnpm test`](https://example.com/ci)\n- [ ] Ship v1",
        "| Budget |  |\n| --- | --- |\n| JS | <= 240 kB |",
        "---",
        "```json\n```",
      ].join("\n\n"),
    );
  });
});

describe("sanitizeMarkdownFileName", () => {
  it("sanitizes titles into safe lowercase .md filenames and falls back to untitled.md", () => {
    expect(sanitizeMarkdownFileName("Architecture Spec v2!")).toBe(
      "architecture-spec-v2.md",
    );
    expect(sanitizeMarkdownFileName("  Notes d'été — Q4 / 2026  ")).toBe(
      "notes-d-ete-q4-2026.md",
    );
    expect(sanitizeMarkdownFileName("roadmap.md")).toBe("roadmap.md");
    expect(sanitizeMarkdownFileName("   ")).toBe("untitled.md");
    expect(sanitizeMarkdownFileName("!!!")).toBe("untitled.md");
    expect(sanitizeMarkdownFileName(null)).toBe("untitled.md");
    expect(sanitizeMarkdownFileName("", "sans-titre")).toBe("sans-titre.md");
  });
});

describe("blobToDataUrl", () => {
  it("encodes a Blob to a base64 data URL in plain Node", async () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const blob = new Blob([bytes], { type: "image/png" });
    await expect(blobToDataUrl(blob)).resolves.toBe(
      "data:image/png;base64,SGVsbG8=",
    );
  });

  it("uses the optional mimeTypeFallback when Blob.type is empty", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    await expect(blobToDataUrl(blob, "image/webp")).resolves.toBe(
      "data:image/webp;base64,AQID",
    );
  });
});
