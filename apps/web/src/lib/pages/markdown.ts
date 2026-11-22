import type { JSONContent } from "@tiptap/core";

export type PageMarkdownImageMode = "everything" | "no-images" | "copy";

export interface SerializePageToMarkdownOptions {
  /** Controls how image nodes are serialized. Defaults to `"copy"`. */
  imageMode?: PageMarkdownImageMode;
  /**
   * Map from local `pageAssets.id` to inline `data:<mime>;base64,...` URLs,
   * used when `imageMode === "everything"`.
   */
  assetDataUrls?: ReadonlyMap<string, string>;
  /**
   * Resolves an inline `emoji` node's canonical name to its Unicode emoji
   * character. Falls back to `:<name>:` when omitted or unresolved.
   */
  resolveEmoji?: (name: string) => string | undefined;
}

interface InlineContext {
  inHeading?: boolean;
  inTableCell?: boolean;
}

interface EffectiveTextMarks {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  linkHref: string | null;
  linkTitle: string | null;
}

type NormalizedInlineItem =
  | { kind: "text"; text: string; marks: EffectiveTextMarks }
  | { kind: "node"; node: JSONContent };

const EMPTY_MARKS: EffectiveTextMarks = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
  linkHref: null,
  linkTitle: null,
};

function extractEffectiveMarks(
  marks: JSONContent["marks"],
): EffectiveTextMarks {
  if (!Array.isArray(marks) || marks.length === 0) {
    return EMPTY_MARKS;
  }

  let bold = false;
  let italic = false;
  let strike = false;
  let code = false;
  let linkHref: string | null = null;
  let linkTitle: string | null = null;

  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        bold = true;
        break;
      case "italic":
        italic = true;
        break;
      case "strike":
        strike = true;
        break;
      case "code":
        code = true;
        break;
      case "link": {
        const href =
          typeof mark.attrs?.href === "string" ? mark.attrs.href.trim() : "";
        if (href.length > 0) {
          linkHref = href;
          const title =
            typeof mark.attrs?.title === "string"
              ? mark.attrs.title.trim()
              : "";
          linkTitle = title.length > 0 ? title : null;
        }
        break;
      }
      // Non-Markdown marks (`underline`, `pageColor`, `textStyle`, etc.)
      // degrade cleanly by preserving their underlying text without syntax.
      default:
        break;
    }
  }

  return { bold, italic, strike, code, linkHref, linkTitle };
}

function marksEqual(a: EffectiveTextMarks, b: EffectiveTextMarks): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.strike === b.strike &&
    a.code === b.code &&
    a.linkHref === b.linkHref &&
    a.linkTitle === b.linkTitle
  );
}

function escapeInlineText(text: string, inTableCell: boolean): string {
  let escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/([`*[\]])/g, "\\$1")
    .replace(/~~/g, "\\~\\~");
  if (inTableCell) {
    escaped = escaped.replace(/\|/g, "\\|");
  }
  return escaped;
}

function formatInlineCode(rawText: string, inTableCell: boolean): string {
  const text = inTableCell ? rawText.replace(/\|/g, "\\|") : rawText;
  let longestBacktickRun = 0;
  let currentRun = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "`") {
      currentRun += 1;
      if (currentRun > longestBacktickRun) longestBacktickRun = currentRun;
    } else {
      currentRun = 0;
    }
  }
  const fence = "`".repeat(longestBacktickRun + 1);
  const needsPadding =
    text.startsWith("`") ||
    text.endsWith("`") ||
    (text.startsWith(" ") && text.endsWith(" ") && text.trim().length > 0);
  return needsPadding ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
}

function wrapWithDelimiter(text: string, delimiter: string): string {
  if (text.trim().length === 0) return text;
  const leadingMatch = /^\s*/.exec(text);
  const trailingMatch = /\s*$/.exec(text);
  const leading = leadingMatch ? leadingMatch[0] : "";
  const trailing = trailingMatch ? trailingMatch[0] : "";
  const core = text.slice(leading.length, text.length - trailing.length);
  return `${leading}${delimiter}${core}${delimiter}${trailing}`;
}

function formatMarkdownUrl(url: string): string {
  if (/[\s()<>]/.test(url)) {
    const safe = url.replace(/[<>]/g, (ch) => encodeURIComponent(ch));
    return `<${safe}>`;
  }
  return url;
}

function formatTextWithoutLink(
  rawText: string,
  marks: EffectiveTextMarks,
  inTableCell: boolean,
): string {
  if (rawText.length === 0) return "";
  let out = marks.code
    ? formatInlineCode(rawText, inTableCell)
    : escapeInlineText(rawText, inTableCell);

  if (marks.italic) {
    out = wrapWithDelimiter(out, "*");
  }
  if (marks.bold) {
    out = wrapWithDelimiter(out, "**");
  }
  if (marks.strike) {
    out = wrapWithDelimiter(out, "~~");
  }
  return out;
}

function normalizeInlineItems(
  nodes: readonly JSONContent[],
): NormalizedInlineItem[] {
  const items: NormalizedInlineItem[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      const text = node.text ?? "";
      if (text.length === 0) continue;
      const marks = extractEffectiveMarks(node.marks);
      const prev = items[items.length - 1];
      if (prev && prev.kind === "text" && marksEqual(prev.marks, marks)) {
        prev.text += text;
      } else {
        items.push({ kind: "text", text, marks });
      }
    } else {
      items.push({ kind: "node", node });
    }
  }
  return items;
}

function serializeEmojiNode(
  node: JSONContent,
  options: SerializePageToMarkdownOptions,
): string {
  const rawName = typeof node.attrs?.name === "string" ? node.attrs.name : "";
  const name = rawName.trim();
  if (!name) return "";
  const resolved = options.resolveEmoji?.(name);
  if (typeof resolved === "string" && resolved.length > 0) {
    return resolved;
  }
  return `:${name}:`;
}

function serializeInline(
  nodes: readonly JSONContent[] | undefined,
  options: SerializePageToMarkdownOptions,
  context: InlineContext = {},
): string {
  if (!Array.isArray(nodes) || nodes.length === 0) return "";
  const inTableCell = context.inTableCell === true;
  const items = normalizeInlineItems(nodes);
  let out = "";

  let index = 0;
  while (index < items.length) {
    const item = items[index];
    if (!item) break;

    if (item.kind === "text" && item.marks.linkHref !== null) {
      const href = item.marks.linkHref;
      const title = item.marks.linkTitle;
      let linkContent = "";
      while (index < items.length) {
        const candidate = items[index];
        if (
          !candidate ||
          candidate.kind !== "text" ||
          candidate.marks.linkHref !== href ||
          candidate.marks.linkTitle !== title
        ) {
          break;
        }
        linkContent += formatTextWithoutLink(
          candidate.text,
          candidate.marks,
          inTableCell,
        );
        index += 1;
      }

      if (linkContent.trim().length === 0) {
        out += linkContent;
      } else {
        const formattedHref = formatMarkdownUrl(href);
        const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
        out += `[${linkContent}](${formattedHref}${titlePart})`;
      }
      continue;
    }

    if (item.kind === "text") {
      out += formatTextWithoutLink(item.text, item.marks, inTableCell);
      index += 1;
      continue;
    }

    const node = item.node;
    if (node.type === "hardBreak") {
      out += context.inHeading || inTableCell ? " " : "  \n";
    } else if (node.type === "emoji") {
      out += serializeEmojiNode(node, options);
    } else if (Array.isArray(node.content)) {
      out += serializeInline(node.content, options, context);
    }
    index += 1;
  }

  return out;
}

const DEFAULT_CALLOUT_PREFIX = "💡";

function prefixQuoteLines(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => (line.length > 0 ? `> ${line}` : ">"))
    .join("\n");
}

function formatCalloutIconLabel(iconName: string): string {
  const spaced = iconName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
  return `**[${spaced || iconName}]**`;
}

function resolveCalloutPrefix(attrs: JSONContent["attrs"]): string {
  if (
    attrs?.logoType === "icon" &&
    typeof attrs.iconName === "string" &&
    attrs.iconName.trim().length > 0
  ) {
    return formatCalloutIconLabel(attrs.iconName.trim());
  }
  if (typeof attrs?.emoji === "string" && attrs.emoji.trim().length > 0) {
    return attrs.emoji.trim();
  }
  return DEFAULT_CALLOUT_PREFIX;
}

function startsWithBlockMarkdownSyntax(line: string): boolean {
  return /^(#{1,6}\s|[-+*]\s|\d+\.\s|```|~~~|>\s?|\|)/.test(line);
}

function collectRawText(nodes: readonly JSONContent[] | undefined): string {
  if (!Array.isArray(nodes) || nodes.length === 0) return "";
  let out = "";
  for (const child of nodes) {
    if (child.type === "text") {
      out += child.text ?? "";
    } else if (child.type === "hardBreak") {
      out += "\n";
    } else if (Array.isArray(child.content)) {
      out += collectRawText(child.content);
    }
  }
  return out;
}

function serializeCodeBlock(node: JSONContent): string {
  const rawLang =
    typeof node.attrs?.language === "string" ? node.attrs.language.trim() : "";
  const language = rawLang.replace(/\s+/g, "");
  const code = collectRawText(node.content).replace(/\r\n?/g, "\n");

  let longestBacktickRun = 0;
  let currentRun = 0;
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] === "`") {
      currentRun += 1;
      if (currentRun > longestBacktickRun) longestBacktickRun = currentRun;
    } else {
      currentRun = 0;
    }
  }
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  if (code.length === 0) {
    return `${fence}${language}\n${fence}`;
  }
  return `${fence}${language}\n${code}\n${fence}`;
}

const LIST_NODE_TYPES = new Set(["bulletList", "orderedList", "taskList"]);

function indentLines(text: string, indent: string): string {
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? `${indent}${line}` : ""))
    .join("\n");
}

function serializeListItem(
  itemNode: JSONContent,
  marker: string,
  continuationIndent: string,
  options: SerializePageToMarkdownOptions,
): string {
  const children = itemNode.content;
  if (!Array.isArray(children) || children.length === 0) {
    return marker.trimEnd();
  }

  const renderedChildren: { type: string | undefined; text: string }[] = [];
  for (const child of children) {
    const rendered = serializeBlock(child, options);
    if (rendered !== null && rendered.length > 0) {
      renderedChildren.push({ type: child.type, text: rendered });
    }
  }

  if (renderedChildren.length === 0) {
    return marker.trimEnd();
  }

  const first = renderedChildren[0]!;
  let result: string;
  if (first.type !== undefined && LIST_NODE_TYPES.has(first.type)) {
    result = `${marker.trimEnd()}\n${indentLines(first.text, continuationIndent)}`;
  } else {
    const firstLines = first.text.split("\n");
    const head = `${marker}${firstLines[0] ?? ""}`;
    const tail =
      firstLines.length > 1
        ? `\n${indentLines(firstLines.slice(1).join("\n"), continuationIndent)}`
        : "";
    result = `${head}${tail}`;
  }

  for (let i = 1; i < renderedChildren.length; i += 1) {
    const child = renderedChildren[i]!;
    const separator =
      child.type !== undefined && LIST_NODE_TYPES.has(child.type)
        ? "\n"
        : "\n\n";
    result += `${separator}${indentLines(child.text, continuationIndent)}`;
  }

  return result;
}

function serializeList(
  node: JSONContent,
  kind: "bullet" | "ordered" | "task",
  options: SerializePageToMarkdownOptions,
): string | null {
  const items = node.content;
  if (!Array.isArray(items) || items.length === 0) return null;

  const rawStart =
    typeof node.attrs?.start === "number" &&
    Number.isInteger(node.attrs.start) &&
    node.attrs.start > 0
      ? node.attrs.start
      : 1;

  const lines: string[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item) continue;
    let marker: string;
    let continuationIndent: string;
    if (kind === "bullet") {
      marker = "- ";
      continuationIndent = "  ";
    } else if (kind === "ordered") {
      marker = `${rawStart + index}. `;
      continuationIndent = " ".repeat(marker.length);
    } else {
      const checked = item.attrs?.checked === true;
      marker = checked ? "- [x] " : "- [ ] ";
      continuationIndent = "  ";
    }
    lines.push(serializeListItem(item, marker, continuationIndent, options));
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function serializeTableCell(
  cellNode: JSONContent,
  options: SerializePageToMarkdownOptions,
): string {
  const children = cellNode.content;
  if (!Array.isArray(children) || children.length === 0) return "";

  const parts: string[] = [];
  for (const child of children) {
    if (child.type === "paragraph" || child.type === "heading") {
      const inline = serializeInline(child.content, options, {
        inTableCell: true,
      })
        .replace(/\r?\n+/g, " ")
        .trim();
      if (inline.length > 0) parts.push(inline);
    } else {
      const rendered = serializeBlock(child, options);
      if (rendered !== null && rendered.length > 0) {
        const collapsed = rendered
          .replace(/(?<!\\)\|/g, "\\|")
          .replace(/\r?\n+/g, " ")
          .trim();
        if (collapsed.length > 0) parts.push(collapsed);
      }
    }
  }
  return parts.join(" ");
}

function serializeTable(
  node: JSONContent,
  options: SerializePageToMarkdownOptions,
): string | null {
  const rows = (node.content ?? []).filter(
    (child) => child.type === "tableRow",
  );
  if (rows.length === 0) return null;

  const matrix: string[][] = [];
  let maxCols = 0;

  for (const row of rows) {
    const cells = (row.content ?? []).filter(
      (child) => child.type === "tableHeader" || child.type === "tableCell",
    );
    const serializedRow: string[] = [];
    for (const cell of cells) {
      serializedRow.push(serializeTableCell(cell, options));
      const rawSpan = cell.attrs?.colspan;
      const colspan =
        typeof rawSpan === "number" && Number.isInteger(rawSpan) && rawSpan > 1
          ? rawSpan
          : 1;
      for (let extra = 1; extra < colspan; extra += 1) {
        serializedRow.push("");
      }
    }
    if (serializedRow.length > maxCols) {
      maxCols = serializedRow.length;
    }
    matrix.push(serializedRow);
  }

  if (maxCols === 0) return null;

  const formatRow = (cells: string[]): string => {
    const padded = Array.from({ length: maxCols }, (_, i) => cells[i] ?? "");
    return `| ${padded.join(" | ")} |`;
  };

  const headerRow = formatRow(matrix[0] ?? []);
  const separatorRow = `| ${Array.from({ length: maxCols }, () => "---").join(" | ")} |`;
  const bodyRows = matrix.slice(1).map(formatRow);

  return [headerRow, separatorRow, ...bodyRows].join("\n");
}

function escapeImageAlt(alt: string): string {
  return alt
    .replace(/\r?\n+/g, " ")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/([[\]])/g, "\\$1");
}

function serializeImage(
  node: JSONContent,
  options: SerializePageToMarkdownOptions,
): string | null {
  const mode: PageMarkdownImageMode = options.imageMode ?? "copy";
  if (mode === "no-images") {
    return null;
  }

  const assetId =
    typeof node.attrs?.assetId === "string" ? node.attrs.assetId.trim() : "";
  const externalSrc =
    typeof node.attrs?.src === "string" ? node.attrs.src.trim() : "";

  let resolvedUrl: string | null = null;
  if (assetId.length > 0) {
    if (mode === "everything") {
      const dataUrl = options.assetDataUrls?.get(assetId);
      if (typeof dataUrl === "string" && dataUrl.length > 0) {
        resolvedUrl = dataUrl;
      }
    }
  } else if (externalSrc.length > 0) {
    resolvedUrl = externalSrc;
  }

  if (!resolvedUrl) {
    return null;
  }

  const rawAlt =
    typeof node.attrs?.alt === "string" && node.attrs.alt.trim().length > 0
      ? node.attrs.alt
      : typeof node.attrs?.name === "string"
        ? node.attrs.name
        : "";
  const alt = escapeImageAlt(rawAlt);
  return `![${alt}](${formatMarkdownUrl(resolvedUrl)})`;
}

function serializeBlocks(
  nodes: readonly JSONContent[] | undefined,
  options: SerializePageToMarkdownOptions,
): string {
  if (!Array.isArray(nodes) || nodes.length === 0) return "";
  const blocks: string[] = [];
  for (const child of nodes) {
    const rendered = serializeBlock(child, options);
    if (rendered !== null && rendered.length > 0) {
      blocks.push(rendered);
    }
  }
  return blocks.join("\n\n");
}

function serializeBlock(
  node: JSONContent,
  options: SerializePageToMarkdownOptions,
): string | null {
  switch (node.type) {
    case "paragraph": {
      const text = serializeInline(node.content, options);
      return text.length > 0 ? text : null;
    }
    case "heading": {
      const rawLevel =
        typeof node.attrs?.level === "number"
          ? Math.round(node.attrs.level)
          : 1;
      const level = Math.min(6, Math.max(1, rawLevel));
      const text = serializeInline(node.content, options, {
        inHeading: true,
      }).trim();
      return text.length > 0 ? `${"#".repeat(level)} ${text}` : null;
    }
    case "horizontalRule":
      return "---";
    case "blockquote": {
      const inner = serializeBlocks(node.content, options);
      return inner.length > 0 ? prefixQuoteLines(inner) : null;
    }
    case "callout": {
      const inner = serializeBlocks(node.content, options);
      if (inner.length === 0) return null;
      const prefix = resolveCalloutPrefix(node.attrs);
      const firstLine = inner.split("\n")[0] ?? "";
      const combined = startsWithBlockMarkdownSyntax(firstLine)
        ? `${prefix}\n\n${inner}`
        : `${prefix} ${inner}`;
      return prefixQuoteLines(combined);
    }
    case "codeBlock":
      return serializeCodeBlock(node);
    case "bulletList":
      return serializeList(node, "bullet", options);
    case "orderedList":
      return serializeList(node, "ordered", options);
    case "taskList":
      return serializeList(node, "task", options);
    case "table":
      return serializeTable(node, options);
    case "image":
      return serializeImage(node, options);
    default: {
      if (Array.isArray(node.content) && node.content.length > 0) {
        const inner = serializeBlocks(node.content, options);
        return inner.length > 0 ? inner : null;
      }
      return null;
    }
  }
}

/**
 * Serializes a lossless TipTap `JSONContent` Page document tree into clean
 * GitHub Flavored Markdown (GFM).
 */
export function serializePageToMarkdown(
  doc: JSONContent | null | undefined,
  options: SerializePageToMarkdownOptions = {},
): string {
  if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) {
    return "";
  }
  return serializeBlocks(doc.content, options);
}

const MAX_MARKDOWN_FILENAME_STEM_LENGTH = 120;

function slugifyFileStem(raw: string): string {
  return raw
    .trim()
    .replace(/\.md$/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_MARKDOWN_FILENAME_STEM_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Sanitizes a Page title into a safe lowercase `<slug>.md` filename, falling
 * back to `untitled.md` (or a sanitized custom fallback stem) when empty.
 */
export function sanitizeMarkdownFileName(
  title: string | null | undefined,
  fallback = "untitled",
): string {
  const stem = typeof title === "string" ? slugifyFileStem(title) : "";
  if (stem.length > 0) {
    return `${stem}.md`;
  }
  const safeFallback = slugifyFileStem(fallback) || "untitled";
  return `${safeFallback}.md`;
}

export { blobToDataUrl } from "@/lib/data-url";
