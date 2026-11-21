import { db } from "@/lib/db/db";
import {
  archivePage,
  duplicatePage,
  restorePage,
  setPageFavorite,
  setPageLocked,
} from "@/lib/db/pages";
import type { Page } from "@/lib/db/schema";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";

export function buildPageUrl(projectId: string, pageId: string): string {
  const path = `/project/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}`;
  return new URL(path, window.location.origin).toString();
}

export function openPageInNewTab(projectId: string, pageId: string): void {
  const url = buildPageUrl(projectId, pageId);
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function copyPageLink(
  projectId: string,
  pageId: string,
  options?: { silent?: boolean },
): Promise<boolean> {
  const url = buildPageUrl(projectId, pageId);
  try {
    await navigator.clipboard.writeText(url);
    if (!options?.silent) {
      const message = i18n.t("pages:actions.linkCopied");
      toast.success(message);
    }
    return true;
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : i18n.t("pages:actions.errors.copyLink"),
    );
    return false;
  }
}

export async function duplicatePageWithToast(
  page: Page,
  options?: { title?: string },
): Promise<string | undefined> {
  const sourceTitle =
    (options?.title ?? page.title).trim() || i18n.t("pages:untitled");
  const copyTitle = i18n.t("pages:actions.copyTitle", { title: sourceTitle });
  try {
    const nextId = await duplicatePage(db, page.id, { title: copyTitle });
    const message = i18n.t("pages:actions.duplicated");
    toast.success(message);
    return nextId;
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : i18n.t("pages:actions.errors.duplicate"),
    );
    return undefined;
  }
}

export async function togglePageLockedWithToast(
  page: Page,
  options?: { silent?: boolean },
): Promise<boolean> {
  const nextLocked = !page.isLocked;
  try {
    await setPageLocked(db, page.id, nextLocked);
    if (!options?.silent) {
      const message = nextLocked
        ? i18n.t("pages:actions.locked")
        : i18n.t("pages:actions.unlocked");
      toast.success(message);
    }
    return true;
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : i18n.t("pages:actions.errors.lock"),
    );
    return false;
  }
}

export async function togglePageFavoriteWithToast(
  page: Page,
): Promise<boolean> {
  try {
    await setPageFavorite(db, page.id, !page.isFavorite);
    return true;
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : i18n.t("pages:actions.errors.favorite"),
    );
    return false;
  }
}

export async function archivePageWithToast(pageId: string): Promise<boolean> {
  try {
    await archivePage(db, pageId);
    const message = i18n.t("pages:actions.archived");
    toast.success(message);
    return true;
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : i18n.t("pages:actions.errors.archive"),
    );
    return false;
  }
}

export async function restorePageWithToast(pageId: string): Promise<boolean> {
  try {
    await restorePage(db, pageId);
    const message = i18n.t("pages:actions.restored");
    toast.success(message);
    return true;
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : i18n.t("pages:actions.errors.restore"),
    );
    return false;
  }
}
