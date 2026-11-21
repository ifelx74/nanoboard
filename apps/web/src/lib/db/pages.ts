import { createId } from "@paralleldrive/cuid2";
import type { JSONContent } from "@tiptap/core";
import Dexie from "dexie";
import type { NanoboardDB } from "./db";
import type { Page, PageContent, PageLogo } from "./schema";
import { createEmptyPageContent, extractContentText } from "../pages/document";

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
