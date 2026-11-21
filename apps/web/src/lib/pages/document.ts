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
export function extractContentText(
  doc: JSONContent | null | undefined,
): string {
  if (!doc) return "";
  const blocks: string[] = [];
  collectBlocks(doc, blocks);
  return blocks.join("\n");
}

function collectAssetIds(node: JSONContent, out: Set<string>): void {
  const assetId = node.attrs?.assetId;
  if (typeof assetId === "string" && assetId.length > 0) {
    out.add(assetId);
  }
  if (!Array.isArray(node.content)) return;
  for (const child of node.content) {
    collectAssetIds(child, out);
  }
}

/**
 * Collects every unique local `assetId` referenced anywhere inside a TipTap
 * JSONContent document tree. External images (`src` only) and empty/null
 * attributes are ignored.
 */
export function extractAssetIds(
  doc: JSONContent | null | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!doc) return out;
  collectAssetIds(doc, out);
  return out;
}

function lookupAssetId(
  idMap: ReadonlyMap<string, string> | Readonly<Record<string, string>>,
  assetId: string,
): string | undefined {
  if (idMap instanceof Map) {
    return idMap.get(assetId);
  }
  const record = idMap as Readonly<Record<string, string>>;
  return Object.prototype.hasOwnProperty.call(record, assetId)
    ? record[assetId]
    : undefined;
}

function cloneAndRewriteNode(
  node: JSONContent,
  idMap: ReadonlyMap<string, string> | Readonly<Record<string, string>>,
): JSONContent {
  const cloned: JSONContent = { ...node };

  if (node.attrs !== undefined) {
    const nextAttrs = structuredClone(node.attrs);
    const assetId = nextAttrs.assetId;
    if (typeof assetId === "string" && assetId.length > 0) {
      const replacement = lookupAssetId(idMap, assetId);
      if (replacement !== undefined) {
        nextAttrs.assetId = replacement;
      }
    }
    cloned.attrs = nextAttrs;
  }

  if (node.marks !== undefined) {
    cloned.marks = structuredClone(node.marks);
  }

  if (Array.isArray(node.content)) {
    cloned.content = node.content.map((child) =>
      cloneAndRewriteNode(child, idMap),
    );
  }

  return cloned;
}

/**
 * Returns a deeply cloned TipTap JSONContent tree with every mapped local
 * `attrs.assetId` replaced by its new ID. Unmapped asset IDs, external image
 * URLs, and all other attributes/marks are preserved without mutating `doc`.
 */
export function rewriteAssetIds(
  doc: JSONContent,
  idMap: ReadonlyMap<string, string> | Readonly<Record<string, string>>,
): JSONContent {
  return cloneAndRewriteNode(doc, idMap);
}
