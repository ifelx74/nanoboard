import type { JSONContent } from "@tiptap/core";

/**
 * Returns a fresh empty TipTap document matching what a newly created Page
 * stores in `pageContents`.
 */
export function createEmptyPageContent(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

function collectInlineText(nodes: readonly JSONContent[]): string {
  let out = "";
  for (const child of nodes) {
    if (child.type === "text") {
      out += child.text ?? "";
    } else if (child.type === "hardBreak") {
      out += "\n";
    } else if (Array.isArray(child.content)) {
      out += collectInlineText(child.content);
    }
  }
  return out;
}

const INLINE_BLOCK_TYPES = new Set(["paragraph", "heading", "codeBlock"]);

function collectBlocks(node: JSONContent, out: string[]): void {
  if (node.type === "text") {
    const text = (node.text ?? "").replace(/\r\n?/g, "\n").trim();
    if (text.length > 0) out.push(text);
    return;
  }

  const children = node.content;
  if (!Array.isArray(children) || children.length === 0) return;

  if (node.type !== undefined && INLINE_BLOCK_TYPES.has(node.type)) {
    const text = collectInlineText(children).replace(/\r\n?/g, "\n").trim();
    if (text.length > 0) out.push(text);
    return;
  }

  if (node.type === "tableRow") {
    const cells: string[] = [];
    for (const cell of children) {
      const cellLines: string[] = [];
      collectBlocks(cell, cellLines);
      const cellText = cellLines.join(" ").trim();
      if (cellText.length > 0) cells.push(cellText);
    }
    if (cells.length > 0) out.push(cells.join(" "));
    return;
  }

  for (const child of children) {
    collectBlocks(child, out);
  }
}

/**
 * Extracts normalized plain text from a lossless TipTap JSONContent tree.
 * Used to populate `pageContents.contentText` for body search and document
 * statistics without hydrating a ProseMirror instance.
 */
export function extractContentText(doc: JSONContent | null | undefined): string {
  if (!doc) return "";
  const blocks: string[] = [];
  collectBlocks(doc, blocks);
  return blocks.join("\n");
}
