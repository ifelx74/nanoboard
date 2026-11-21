import { createId } from "@paralleldrive/cuid2";
import type { JSONContent } from "@tiptap/core";
import Dexie from "dexie";
import type { NanoboardDB } from "./db";
import type { Page, PageAsset, PageContent, PageLogo } from "./schema";
import {
  createEmptyPageContent,
  extractAssetIds,
  extractContentText,
  rewriteAssetIds,
} from "../pages/document";

export interface CreatePageInput {
  title?: string;
  logo?: PageLogo | null;
  contentJson?: JSONContent;
}

export interface PageWithContent {
  page: Page;
  content: PageContent;
}

/**
 * Atomically creates a Page metadata row and its matching `pageContents` row
 * (with derived plain text) and returns the new page id.
 */
export async function createPage(
  database: NanoboardDB,
  projectId: string,
  input?: CreatePageInput,
): Promise<string> {
  const id = createId();
  const now = Date.now();
  const contentJson = input?.contentJson ?? createEmptyPageContent();
  const contentText = extractContentText(contentJson);

  const page: Page = {
    id,
    projectId,
    title: input?.title ?? "",
    logo: input?.logo ?? null,
    isFavorite: false,
    isLocked: false,
    createdAt: now,
    updatedAt: now,
  };

  const content: PageContent = {
    pageId: id,
    projectId,
    contentJson,
    contentText,
  };

  await database.transaction(
    "rw",
    [database.pages, database.pageContents],
    async () => {
      await database.pages.add(page);
      await database.pageContents.add(content);
    },
  );

  return id;
}

/**
 * Lists lightweight Page metadata rows for a project, ordered most-recently
 * updated first via the `[projectId+updatedAt]` compound index. Never reads
 * `pageContents` or `pageAssets`.
 */
export function listProjectPages(
  database: NanoboardDB,
  projectId: string,
): Promise<Page[]> {
  return database.pages
    .where("[projectId+updatedAt]")
    .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey])
    .reverse()
    .toArray();
}

/**
 * Scans `pageContents` for a project to build a lightweight `pageId -> contentText`
 * map for body search. Called only on demand when the list view's search query
 * is non-empty so idle list views never read document bodies.
 */
export async function listProjectPageContentTexts(
  database: NanoboardDB,
  projectId: string,
): Promise<Map<string, string>> {
  const texts = new Map<string, string>();
  await database.pageContents
    .where("projectId")
    .equals(projectId)
    .each((row) => {
      texts.set(row.pageId, row.contentText);
    });
  return texts;
}

/** Reads lightweight Page metadata by id without loading document content. */
export function getPage(
  database: NanoboardDB,
  pageId: string,
): Promise<Page | undefined> {
  return database.pages.get(pageId);
}

/**
 * Loads a single page together with its `pageContents` row in one read
 * transaction. When `projectId` is supplied, cross-project mismatches return
 * `undefined` so routes can render a clean not-found view.
 */
export async function getPageWithContent(
  database: NanoboardDB,
  pageId: string,
  projectId?: string,
): Promise<PageWithContent | undefined> {
  return database.transaction(
    "r",
    [database.pages, database.pageContents],
    async () => {
      const page = await database.pages.get(pageId);
      if (!page) return undefined;
      if (projectId !== undefined && page.projectId !== projectId) {
        return undefined;
      }
      const existingContent = await database.pageContents.get(pageId);
      const content: PageContent = existingContent ?? {
        pageId: page.id,
        projectId: page.projectId,
        contentJson: createEmptyPageContent(),
        contentText: "",
      };
      return { page, content };
    },
  );
}

/** Updates a page's title and bumps its `updatedAt` timestamp. */
export async function updatePageTitle(
  database: NanoboardDB,
  pageId: string,
  title: string,
): Promise<void> {
  const updated = await database.pages.update(pageId, {
    title,
    updatedAt: Date.now(),
  });
  if (updated === 0) {
    throw new Error("Page not found.");
  }
}

/**
 * Atomically saves a page's lossless TipTap `contentJson`, derives normalized
 * `contentText`, and advances `pages.updatedAt`.
 */
export async function savePageContent(
  database: NanoboardDB,
  pageId: string,
  contentJson: JSONContent,
): Promise<void> {
  const contentText = extractContentText(contentJson);
  const now = Date.now();

  await database.transaction(
    "rw",
    [database.pages, database.pageContents],
    async () => {
      const page = await database.pages.get(pageId);
      if (!page) {
        throw new Error("Page not found.");
      }
      await database.pageContents.put({
        pageId,
        projectId: page.projectId,
        contentJson,
        contentText,
      });
      await database.pages.update(pageId, { updatedAt: now });
    },
  );
}

/** Shared archive predicate: `archivedAt` absent means active. */
export function isPageArchived(page: Pick<Page, "archivedAt">): boolean {
  return page.archivedAt !== undefined;
}

/**
 * Soft-archives a page by stamping `archivedAt` and `updatedAt`. Archiving an
 * already-archived page is an idempotent no-op. Throws on a missing page.
 */
export async function archivePage(
  database: NanoboardDB,
  pageId: string,
): Promise<void> {
  const now = Date.now();
  await database.transaction("rw", database.pages, async () => {
    const page = await database.pages.get(pageId);
    if (!page) {
      throw new Error("Page not found.");
    }
    if (isPageArchived(page)) return;
    await database.pages.put({ ...page, archivedAt: now, updatedAt: now });
  });
}

/**
 * Restores an archived page by clearing `archivedAt` and bumping `updatedAt`.
 * Restoring an already-active page is a no-op. Throws on a missing page.
 */
export async function restorePage(
  database: NanoboardDB,
  pageId: string,
): Promise<void> {
  const now = Date.now();
  await database.transaction("rw", database.pages, async () => {
    const page = await database.pages.get(pageId);
    if (!page) {
      throw new Error("Page not found.");
    }
    if (!isPageArchived(page)) return;
    const restored: Page = { ...page, updatedAt: now };
    delete restored.archivedAt;
    await database.pages.put(restored);
  });
}

/** Updates a page's lock state and bumps `updatedAt`. Throws on missing page. */
export async function setPageLocked(
  database: NanoboardDB,
  pageId: string,
  isLocked: boolean,
): Promise<void> {
  const updated = await database.pages.update(pageId, {
    isLocked,
    updatedAt: Date.now(),
  });
  if (updated === 0) {
    throw new Error("Page not found.");
  }
}

/** Updates a page's favorite flag and bumps `updatedAt`. Throws on missing page. */
export async function setPageFavorite(
  database: NanoboardDB,
  pageId: string,
  isFavorite: boolean,
): Promise<void> {
  const updated = await database.pages.update(pageId, {
    isFavorite,
    updatedAt: Date.now(),
  });
  if (updated === 0) {
    throw new Error("Page not found.");
  }
}

/**
 * Permanently deletes an archived page and all of its `pageContents` and
 * `pageAssets` rows in one atomic transaction. Enforces the archive-before-delete
 * invariant at the data layer: active pages throw and leave every table untouched.
 */
export async function deletePage(
  database: NanoboardDB,
  pageId: string,
): Promise<void> {
  await database.transaction(
    "rw",
    [database.pages, database.pageContents, database.pageAssets],
    async () => {
      const page = await database.pages.get(pageId);
      if (!page) {
        throw new Error("Page not found.");
      }
      if (!isPageArchived(page)) {
        throw new Error("Only archived pages can be deleted.");
      }
      await database.pageAssets.where("pageId").equals(pageId).delete();
      await database.pageContents.delete(pageId);
      await database.pages.delete(pageId);
    },
  );
}

export interface DuplicatePageOptions {
  /** Override the duplicated page title (e.g., localized `"<title> (copie)"`). */
  title?: string;
}

/**
 * Atomically clones a page's metadata, document content, and referenced local
 * `pageAssets` under fresh IDs in one transaction. Resets lock, archive, and
 * favorite flags on the copy so editing or deleting the copy never affects the
 * original. Returns the new page ID.
 */
export async function duplicatePage(
  database: NanoboardDB,
  pageId: string,
  options?: DuplicatePageOptions,
): Promise<string> {
  const newPageId = createId();
  const now = Date.now();

  await database.transaction(
    "rw",
    [database.pages, database.pageContents, database.pageAssets],
    async () => {
      const sourcePage = await database.pages.get(pageId);
      if (!sourcePage) {
        throw new Error("Page not found.");
      }

      const sourceContent = await database.pageContents.get(pageId);
      const sourceJson = sourceContent?.contentJson ?? createEmptyPageContent();
      const sourceAssets = await database.pageAssets
        .where("pageId")
        .equals(pageId)
        .toArray();

      const referencedAssetIds = extractAssetIds(sourceJson);
      const assetIdMap = new Map<string, string>();
      const clonedAssets: PageAsset[] = [];

      for (const asset of sourceAssets) {
        if (!referencedAssetIds.has(asset.id)) continue;
        const nextAssetId = createId();
        assetIdMap.set(asset.id, nextAssetId);
        clonedAssets.push({
          id: nextAssetId,
          pageId: newPageId,
          projectId: sourcePage.projectId,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
          blob: asset.blob.slice(0, asset.blob.size, asset.mimeType),
          createdAt: now,
        });
      }

      const clonedJson = rewriteAssetIds(sourceJson, assetIdMap);
      const clonedText = extractContentText(clonedJson);
      const baseTitle = sourcePage.title.trim();
      const nextTitle =
        options?.title ??
        (baseTitle.length > 0 ? `${baseTitle} (Copy)` : "Untitled (Copy)");

      const clonedPage: Page = {
        id: newPageId,
        projectId: sourcePage.projectId,
        title: nextTitle,
        logo: sourcePage.logo ? { ...sourcePage.logo } : null,
        isFavorite: false,
        isLocked: false,
        createdAt: now,
        updatedAt: now,
      };

      const clonedContent: PageContent = {
        pageId: newPageId,
        projectId: sourcePage.projectId,
        contentJson: clonedJson,
        contentText: clonedText,
      };

      await database.pages.add(clonedPage);
      await database.pageContents.add(clonedContent);
      if (clonedAssets.length > 0) {
        await database.pageAssets.bulkAdd(clonedAssets);
      }
    },
  );

  return newPageId;
}
