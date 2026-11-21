import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  Info,
  Link2,
  Lock,
  LockOpen,
  MoreHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageLogoIcon } from "@/components/pages/page-logo";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isPageArchived } from "@/lib/db/pages";
import type { Page } from "@/lib/db/schema";
import { formatMediumDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  archivePageWithToast,
  copyPageLink,
  duplicatePageWithToast,
  openPageInNewTab,
  restorePageWithToast,
  togglePageFavoriteWithToast,
  togglePageLockedWithToast,
} from "../page-actions";

type PagesListRowProps = {
  projectId: string;
  page: Page;
  onRequestDelete: (page: Page) => void;
};

/**
 * Single row in the Pages list matching Plane's layout and ergonomics:
 * logo/icon, title ("Untitled" fallback), lock badge, created-date info
 * tooltip, quick favorite star toggle, `...` menu button, and right-click
 * context menu.
 */
export function PagesListRow({
  projectId,
  page,
  onRequestDelete,
}: PagesListRowProps) {
  const { t } = useTranslation("pages");
  const archived = isPageArchived(page);
  const displayTitle = page.title.trim() || t("untitled");
  const createdDate = formatMediumDate(new Date(page.createdAt));

  function handleOpenInNewTab() {
    openPageInNewTab(projectId, page.id);
  }

  function handleCopyLink() {
    void copyPageLink(projectId, page.id);
  }

  function handleDuplicate() {
    void duplicatePageWithToast(page);
  }

  function handleToggleLock() {
    void togglePageLockedWithToast(page);
  }

  function handleArchiveToggle() {
    if (archived) {
      void restorePageWithToast(page.id);
    } else {
      void archivePageWithToast(page.id);
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div className="group flex min-h-[52px] items-center justify-between gap-4 border-b border-border/60 px-4 py-2 text-[13px] transition-colors hover:bg-accent/50" />
        }
      >
        <Link
          to="/project/$projectId/pages/$pageId"
          params={{ projectId, pageId: page.id }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PageLogoIcon logo={page.logo} />
          <span
            className="truncate font-medium text-foreground"
            title={displayTitle}
          >
            {displayTitle}
          </span>
          {page.isLocked && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="inline-flex shrink-0 items-center text-muted-foreground"
                    aria-label={t("detail.locked")}
                  >
                    <Lock className="size-3.5" aria-hidden="true" />
                  </span>
                }
              />
              <TooltipContent>{t("detail.locked")}</TooltipContent>
            </Tooltip>
          )}
        </Link>

        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  aria-label={t("list.createdOn", { date: createdDate })}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-4" aria-hidden="true" />
                </span>
              }
            />
            <TooltipContent>
              {t("list.createdOn", { date: createdDate })}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={
                    page.isFavorite
                      ? t("actions.removeFavorite")
                      : t("actions.addFavorite")
                  }
                  aria-pressed={page.isFavorite}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void togglePageFavoriteWithToast(page);
                  }}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    className={cn(
                      "size-4",
                      page.isFavorite && "fill-amber-400 text-amber-500",
                    )}
                    aria-hidden="true"
                  />
                </button>
              }
            />
            <TooltipContent>
              {page.isFavorite
                ? t("actions.removeFavorite")
                : t("actions.addFavorite")}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("list.rowActions")}
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" side="bottom" className="w-48">
              <DropdownMenuItem onClick={handleOpenInNewTab}>
                <ExternalLink aria-hidden="true" />
                {t("actions.openInNewTab")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Link2 aria-hidden="true" />
                {t("actions.copyLink")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy aria-hidden="true" />
                {t("actions.makeCopy")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleLock}>
                {page.isLocked ? (
                  <LockOpen aria-hidden="true" />
                ) : (
                  <Lock aria-hidden="true" />
                )}
                {page.isLocked ? t("actions.unlock") : t("actions.lock")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchiveToggle}>
                {archived ? (
                  <ArchiveRestore aria-hidden="true" />
                ) : (
                  <Archive aria-hidden="true" />
                )}
                {archived ? t("actions.restore") : t("actions.archive")}
              </DropdownMenuItem>
              {archived && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onRequestDelete(page)}
                  >
                    <Trash2 aria-hidden="true" />
                    {t("actions.delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleOpenInNewTab}>
          <ExternalLink aria-hidden="true" />
          {t("actions.openInNewTab")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyLink}>
          <Link2 aria-hidden="true" />
          {t("actions.copyLink")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy aria-hidden="true" />
          {t("actions.makeCopy")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleToggleLock}>
          {page.isLocked ? (
            <LockOpen aria-hidden="true" />
          ) : (
            <Lock aria-hidden="true" />
          )}
          {page.isLocked ? t("actions.unlock") : t("actions.lock")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleArchiveToggle}>
          {archived ? (
            <ArchiveRestore aria-hidden="true" />
          ) : (
            <Archive aria-hidden="true" />
          )}
          {archived ? t("actions.restore") : t("actions.archive")}
        </ContextMenuItem>
        {archived && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => onRequestDelete(page)}
            >
              <Trash2 aria-hidden="true" />
              {t("actions.delete")}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
