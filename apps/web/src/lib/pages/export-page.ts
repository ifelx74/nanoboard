import type { JSONContent } from "@tiptap/core";
import type { NanoboardDB } from "@/lib/db/db";
import { getPageAssets } from "@/lib/db/page-assets";
import { triggerBlobDownload } from "@/lib/download";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { extractAssetIds } from "./document";
import { resolveEmojiCharByName } from "./emoji-data";
import {
  blobToDataUrl,
  sanitizeMarkdownFileName,
  serializePageToMarkdown,
  type PageMarkdownImageMode,
} from "./markdown";

/**
 * Lazy-loaded Markdown copy & `.md` export runner for Pages.
 * Imports `@/lib/pages/emoji-data` so keep this module strictly behind dynamic
 * `import()` / `React.lazy()` boundaries (never on the initial boot path).
 */

export type PageExportScope = "everything" | "no-images";

/**
 * Builds GFM Markdown for a Page document, resolving local `pageAssets` blobs
 * to inline `data:` URLs when `imageMode === "everything"` and resolving inline
 * TipTap emoji nodes via the local Unicode emoji catalog.
 */
export async function buildPageMarkdown(
  database: NanoboardDB,
  pageId: string,
  contentJson: JSONContent | null | undefined,
  imageMode: PageMarkdownImageMode,
): Promise<string> {
  let assetDataUrls: Map<string, string> | undefined;

  if (imageMode === "everything") {
    const referencedIds = extractAssetIds(contentJson);
    if (referencedIds.size > 0) {
      const assets = await getPageAssets(database, pageId);
      const relevantAssets = assets.filter((asset) =>
        referencedIds.has(asset.id),
      );
      if (relevantAssets.length > 0) {
        assetDataUrls = new Map<string, string>();
        for (const asset of relevantAssets) {
          const dataUrl = await blobToDataUrl(asset.blob, asset.mimeType);
          assetDataUrls.set(asset.id, dataUrl);
        }
      }
    }
  }

  return serializePageToMarkdown(contentJson, {
    imageMode,
    assetDataUrls,
    resolveEmoji: resolveEmojiCharByName,
  });
}

/**
 * Copies a Page's GFM Markdown to the clipboard (preserving external image URLs
 * and omitting local binary blobs) with localized toast feedback.
 */
export async function copyPageMarkdownToClipboard(
  database: NanoboardDB,
  pageId: string,
  contentJson: JSONContent | null | undefined,
): Promise<boolean> {
  try {
    const markdown = await buildPageMarkdown(
      database,
      pageId,
      contentJson,
      "copy",
    );
    await navigator.clipboard.writeText(markdown);
    const successMessage = i18n.t("pages:detail.copyMarkdownSuccess");
    toast.success(successMessage);
    return true;
  } catch (error) {
    const fallbackError = i18n.t("pages:detail.copyMarkdownFailed");
    toast.error(error instanceof Error ? error.message : fallbackError);
    return false;
  }
}

export interface DownloadPageMarkdownInput {
  pageId: string;
  title: string;
  contentJson: JSONContent | null | undefined;
  scope: PageExportScope;
}

/**
 * Serializes a Page to UTF-8 Markdown according to `scope` (`"everything"` or
 * `"no-images"`) and triggers a browser `.md` download named after the
 * sanitized page title.
 */
export async function downloadPageMarkdown(
  database: NanoboardDB,
  input: DownloadPageMarkdownInput,
): Promise<string> {
  const markdown = await buildPageMarkdown(
    database,
    input.pageId,
    input.contentJson,
    input.scope,
  );
  const fileName = sanitizeMarkdownFileName(input.title);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  triggerBlobDownload(blob, fileName);
  return fileName;
}
