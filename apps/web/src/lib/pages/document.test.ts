import { describe, expect, it } from "vitest";
import { createEmptyPageContent, extractContentText } from "./document";

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
