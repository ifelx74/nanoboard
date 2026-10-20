import type { AnyExtension, JSONContent } from "@tiptap/core";
import type { MarkdownManager } from "@tiptap/markdown";
import { formatMarkdown } from "@/lib/editor/markdown";

const HTML_TAG_PATTERN =
  /<(?:p|div|br|hr|h[1-6]|ul|ol|li|blockquote|pre|code|strong|b|em|i|u|s|del|a|img|table|thead|tbody|tr|td|th|span|input)\b[^>]*>/i;

interface EditorKit {
  manager: MarkdownManager;
  extensions: AnyExtension[];
  generateJSON: typeof import("@tiptap/core").generateJSON;
  generateHTML: typeof import("@tiptap/core").generateHTML;
}

let kitPromise: Promise<EditorKit> | null = null;

function loadEditorKit(): Promise<EditorKit> {
  if (!kitPromise) {
    kitPromise = createEditorKit().catch((error: unknown) => {
      kitPromise = null;
      throw error;
    });
  }
  return kitPromise;
}

async function createEditorKit(): Promise<EditorKit> {
  const [core, markdown, preset] = await Promise.all([
    import("@tiptap/core"),
    import("@tiptap/markdown"),
    import("@/lib/editor/preset"),
  ]);
  const extensions = preset.createDescriptionExtensions("");
  return {
    manager: new markdown.MarkdownManager({
      extensions,
      markedOptions: { breaks: true, gfm: true },
    }),
    extensions,
    generateJSON: core.generateJSON,
    generateHTML: core.generateHTML,
  };
}

export function looksLikeHtml(value: string): boolean {
  return HTML_TAG_PATTERN.test(value);
}

export async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown.trim()) return "";
  const { manager, extensions, generateHTML } = await loadEditorKit();
  return generateHTML(manager.parse(markdown), extensions).trim();
}

export async function htmlToMarkdown(html: string): Promise<string> {
  if (!html.trim()) return "";
  const { manager, extensions, generateJSON } = await loadEditorKit();
  try {
    const json = generateJSON(html, extensions) as JSONContent;
    return formatMarkdown(manager.serialize(json));
  } catch {
    const text = html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return formatMarkdown(text);
  }
}

export async function toStoredDescription(value: string): Promise<string> {
  return looksLikeHtml(value) ? htmlToMarkdown(value) : formatMarkdown(value);
}
