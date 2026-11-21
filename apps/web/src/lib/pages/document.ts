import type { JSONContent } from "@tiptap/core";
import {
  deriveExternalImageFileName,
  validateExternalImageUrl,
} from "./image-upload";

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

export type PageHeadingLevel = 1 | 2 | 3;

export interface PageHeadingEntry {
  /** Node `attrs.id` (from UniqueID) when present, or a DOM-order fallback (`heading-<index>`). */
  id: string;
  /** Heading level (H1–H3). H4–H6 are excluded from the page outline. */
  level: PageHeadingLevel;
  /** Single-line trimmed text of the heading. */
  text: string;
}

function isOutlineHeadingLevel(level: unknown): level is PageHeadingLevel {
  return level === 1 || level === 2 || level === 3;
}

function collectHeadings(
  node: JSONContent,
  out: PageHeadingEntry[],
  counter: { h1ToH3Count: number },
): void {
  if (node.type === "heading") {
    const level = node.attrs?.level;
    if (isOutlineHeadingLevel(level)) {
      const domIndex = counter.h1ToH3Count;
      counter.h1ToH3Count += 1;

      const text = Array.isArray(node.content)
        ? collectInlineText(node.content).replace(/\s+/g, " ").trim()
        : "";
      if (text.length > 0) {
        const rawId = node.attrs?.id;
        const id =
          typeof rawId === "string" && rawId.trim().length > 0
            ? rawId.trim()
            : `heading-${domIndex}`;
        out.push({ id, level, text });
      }
    }
    return;
  }

  if (!Array.isArray(node.content)) return;
  for (const child of node.content) {
    collectHeadings(child, out, counter);
  }
}

/**
 * Extracts ordered H1–H3 outline entries from a TipTap `JSONContent` tree,
 * skipping H4–H6 and empty headings while preserving each heading's level,
 * normalized text, and anchor ID.
 */
export function extractHeadings(
  doc: JSONContent | null | undefined,
): PageHeadingEntry[] {
  if (!doc) return [];
  const out: PageHeadingEntry[] = [];
  collectHeadings(doc, out, { h1ToH3Count: 0 });
  return out;
}

const READING_WORDS_PER_MINUTE = 200;

export interface PageDocumentStats {
  words: number;
  characters: number;
  paragraphs: number;
  readTimeSeconds: number;
  readTimeMinutes: number;
  readTimeLabel: string;
}

/**
 * Formats an estimated read duration in seconds matching Plane's Info panel:
 * `< 60s` renders as `"<n>s"`, and `>= 60s` rounds up to minutes (`"<m>m"`).
 */
export function formatPageReadTime(readTimeSeconds: number): string {
  if (!Number.isFinite(readTimeSeconds) || readTimeSeconds <= 0) {
    return "0s";
  }
  const roundedSeconds = Math.ceil(readTimeSeconds);
  if (roundedSeconds < 60) {
    return `${roundedSeconds}s`;
  }
  return `${Math.ceil(roundedSeconds / 60)}m`;
}

function collectStatsNodes(
  node: JSONContent,
  acc: { characters: number; paragraphs: number },
): void {
  if (node.type === "text") {
    acc.characters += (node.text ?? "").length;
    return;
  }

  const children = node.content;
  if (!Array.isArray(children) || children.length === 0) return;

  if (node.type === "paragraph") {
    const inline = collectInlineText(children);
    const trimmed = inline.trim();
    if (trimmed.length > 0) {
      acc.paragraphs += 1;
      acc.characters += trimmed.length;
    }
    return;
  }

  if (node.type !== undefined && INLINE_BLOCK_TYPES.has(node.type)) {
    const trimmed = collectInlineText(children).replace(/\r\n?/g, "\n").trim();
    if (trimmed.length > 0) {
      acc.characters += trimmed.length;
    }
    return;
  }

  for (const child of children) {
    collectStatsNodes(child, acc);
  }
}

/**
 * Computes document statistics (words, characters, non-empty paragraphs, and
 * estimated read time at 200 WPM) from a lossless TipTap `JSONContent` tree.
 */
export function computePageStats(
  doc: JSONContent | null | undefined,
): PageDocumentStats {
  if (!doc) {
    return {
      words: 0,
      characters: 0,
      paragraphs: 0,
      readTimeSeconds: 0,
      readTimeMinutes: 0,
      readTimeLabel: "0s",
    };
  }

  const plainText = extractContentText(doc).trim();
  const words = plainText.length === 0 ? 0 : plainText.split(/\s+/).length;

  const acc = { characters: 0, paragraphs: 0 };
  collectStatsNodes(doc, acc);

  const readTimeSeconds =
    words === 0 ? 0 : Math.ceil((words / READING_WORDS_PER_MINUTE) * 60);
  const readTimeMinutes =
    readTimeSeconds === 0 ? 0 : Math.ceil(readTimeSeconds / 60);

  return {
    words,
    characters: acc.characters,
    paragraphs: acc.paragraphs,
    readTimeSeconds,
    readTimeMinutes,
    readTimeLabel: formatPageReadTime(readTimeSeconds),
  };
}

export interface PageImageEntry {
  /** Node `attrs.id` (from UniqueID) when present, or a deterministic fallback key. */
  id: string;
  /** Canonical DOM anchor ID (`image-<nodeId>`) when `attrs.id` is present, else `null`. */
  anchorId: string | null;
  /** Local `pageAssets` row ID, or `null` for external images. */
  assetId: string | null;
  /** Validated external `http(s)` image URL, or `null` for local assets. */
  src: string | null;
  /** Display / download filename (falls back to `alt`, external filename, or `""`). */
  name: string;
  /** Alt text from node attributes. */
  alt: string;
}

function collectPageImages(
  node: JSONContent,
  out: PageImageEntry[],
  counter: { imageIndex: number },
): void {
  if (node.type === "image" || node.type === "customImage") {
    const rawAssetId = node.attrs?.assetId;
    const assetId =
      typeof rawAssetId === "string" && rawAssetId.trim().length > 0
        ? rawAssetId.trim()
        : null;

    const rawSrc = node.attrs?.src;
    const safeSrc =
      !assetId && typeof rawSrc === "string"
        ? validateExternalImageUrl(rawSrc)
        : null;

    if (assetId || safeSrc) {
      const idx = counter.imageIndex;
      counter.imageIndex += 1;

      const rawId = node.attrs?.id;
      const nodeId =
        typeof rawId === "string" && rawId.trim().length > 0
          ? rawId.trim()
          : null;

      const rawName = node.attrs?.name;
      const trimmedName = typeof rawName === "string" ? rawName.trim() : "";
      const rawAlt = node.attrs?.alt;
      const alt = typeof rawAlt === "string" ? rawAlt.trim() : "";

      const name =
        trimmedName ||
        alt ||
        (safeSrc ? deriveExternalImageFileName(safeSrc) : "");

      out.push({
        id: nodeId ?? `image-node-${idx}`,
        anchorId: nodeId ? `image-${nodeId}` : null,
        assetId,
        src: safeSrc,
        name,
        alt,
      });
    }
    return;
  }

  if (!Array.isArray(node.content)) return;
  for (const child of node.content) {
    collectPageImages(child, out, counter);
  }
}

/**
 * Extracts all populated local (`assetId`) and external (`http(s)` `src`) image
 * blocks in document order for the right navigation pane's Assets tab. Pending
 * placeholders and unsafe URL protocols are skipped.
 */
export function extractPageImages(
  doc: JSONContent | null | undefined,
): PageImageEntry[] {
  if (!doc) return [];
  const out: PageImageEntry[] = [];
  collectPageImages(doc, out, { imageIndex: 0 });
  return out;
}
