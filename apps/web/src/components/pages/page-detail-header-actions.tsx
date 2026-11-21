import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Link2,
  Lock,
  LockOpen,
  MoreHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
  restorePageWithToast,
  togglePageFavoriteWithToast,
  togglePageLockedWithToast,
} from "./page-actions";
import { PageDeleteDialog } from "./page-delete-dialog";

const UNLOCK_FEEDBACK_MS = 600;
const COPY_FEEDBACK_MS = 1_000;

export type PageDetailHeaderActionsProps = {
  projectId: string;
  page: Page;
  /** Live title override while editing so delete confirmation reflects unsaved edits. */
  displayTitle?: string;
  /**
   * Optional slot rendered at the top of the `...` Options dropdown (separated
   * from action items by a divider) — reserved for layout switches such as
   * `Full width` and `Sticky toolbar`.
   */
  optionsTopSlot?: ReactNode;
  /**
   * Optional slot rendered immediately before `Make a copy` in the `...` Options
   * dropdown — reserved for `Copy markdown`.
   */
  optionsBeforeCopySlot?: ReactNode;
  /**
   * Optional slot rendered at the bottom of the `...` Options dropdown —
   * reserved for `Export`.
   */
  optionsBottomSlot?: ReactNode;
};

/**
 * Right-side header controls for a Page detail view:
 * Archived pill (when archived), Lock/Unlock toggle with brief unlock feedback,
 * Copy link with confirmation state, Favorite star, and an extensible `...`
 * Options menu.
 */
export function PageDetailHeaderActions({
  projectId,
  page,
  displayTitle,
  optionsTopSlot,
  optionsBeforeCopySlot,
  optionsBottomSlot,
}: PageDetailHeaderActionsProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("pages");
  const archived = isPageArchived(page);

  const [justUnlocked, setJustUnlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setJustUnlocked(false);
    setCopied(false);
    setDeleteDialogOpen(false);
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, [page.id]);

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  async function handleToggleLock() {
    const wasLocked = page.isLocked;
    const ok = await togglePageLockedWithToast(page, { silent: true });
    if (!ok) return;

    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }

    if (wasLocked) {
      setJustUnlocked(true);
      unlockTimerRef.current = setTimeout(() => {
        setJustUnlocked(false);
        unlockTimerRef.current = null;
      }, UNLOCK_FEEDBACK_MS);
    } else {
      setJustUnlocked(false);
    }
  }

  async function handleCopyLink() {
    const ok = await copyPageLink(projectId, page.id, { silent: true });
    if (!ok) return;
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }

  async function handleDuplicate() {
    const newPageId = await duplicatePageWithToast(page);
    if (!newPageId) return;
    void navigate({
      to: "/project/$projectId/pages/$pageId",
      params: { projectId, pageId: newPageId },
    });
  }

  async function handleArchiveToggle() {
    if (archived) {
      await restorePageWithToast(page.id);
    } else {
      await archivePageWithToast(page.id);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {archived && page.archivedAt !== undefined && (
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm bg-brand-100 px-2 text-[11px] font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
            <Archive className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-36 truncate sm:max-w-none">
              {t("detail.archivedAt", {
                date: formatMediumDate(new Date(page.archivedAt)),
              })}
            </span>
          </span>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              page.isLocked ? (
                <button
                  type="button"
                  onClick={() => void handleToggleLock()}
                  aria-label={t("actions.unlock")}
                  className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm bg-brand-100/80 px-2 text-[11px] font-medium text-brand-800 transition-colors hover:bg-brand-200/80 dark:bg-brand-900/40 dark:text-brand-300 dark:hover:bg-brand-900/60"
                >
                  <Lock className="size-3 shrink-0" aria-hidden="true" />
                  <span>{t("detail.locked")}</span>
                </button>
              ) : justUnlocked ? (
                <button
                  type="button"
                  onClick={() => void handleToggleLock()}
                  aria-label={t("actions.lock")}
                  className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm bg-muted px-2 text-[11px] font-medium text-muted-foreground transition-opacity"
                >
                  <LockOpen className="size-3 shrink-0" aria-hidden="true" />
                  <span>{t("detail.unlocked")}</span>
                </button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("actions.lock")}
                  onClick={() => void handleToggleLock()}
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  <Lock className="size-3.5" aria-hidden="true" />
                </Button>
              )
            }
          />
          <TooltipContent>
            {page.isLocked ? t("actions.unlock") : t("actions.lock")}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={copied ? t("detail.copied") : t("actions.copyLink")}
                onClick={() => void handleCopyLink()}
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check
                    className="size-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Link2 className="size-3.5" aria-hidden="true" />
                )}
              </Button>
            }
          />
          <TooltipContent>
            {copied ? t("detail.copied") : t("actions.copyLink")}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={
                  page.isFavorite
                    ? t("actions.removeFavorite")
                    : t("actions.addFavorite")
                }
                aria-pressed={page.isFavorite}
                onClick={() => void togglePageFavoriteWithToast(page)}
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <Star
                  className={cn(
                    "size-3.5",
                    page.isFavorite && "fill-amber-400 text-amber-500",
                  )}
                  aria-hidden="true"
                />
              </Button>
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
                aria-label={t("detail.options")}
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" side="bottom" className="w-52">
            {optionsTopSlot && (
              <>
                {optionsTopSlot}
                <DropdownMenuSeparator />
              </>
            )}
            {optionsBeforeCopySlot}
            <DropdownMenuItem onClick={() => void handleDuplicate()}>
              <Copy aria-hidden="true" />
              {t("actions.makeCopy")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleArchiveToggle()}>
              {archived ? (
                <ArchiveRestore aria-hidden="true" />
              ) : (
                <Archive aria-hidden="true" />
              )}
              {archived ? t("actions.restore") : t("actions.archive")}
            </DropdownMenuItem>
            {archived && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 aria-hidden="true" />
                {t("actions.delete")}
              </DropdownMenuItem>
            )}
            {optionsBottomSlot}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <PageDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        pageId={page.id}
        pageTitle={displayTitle ?? page.title}
        onDeleted={() => {
          void navigate({
            to: "/project/$projectId/pages",
            params: { projectId },
            search: { tab: "archived" },
            replace: true,
          });
        }}
      />
    </>
  );
}
