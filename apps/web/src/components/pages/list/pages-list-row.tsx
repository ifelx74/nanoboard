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
  type LucideIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
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

type RowMenuAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

type MenuItemComponent = ComponentType<{
  onClick?: () => void;
  variant?: "default" | "destructive";
  children?: ReactNode;
}>;

function PageRowMenuItems({
  actions,
  archived,
  deleteLabel,
  onDelete,
  Item,
  Separator,
}: {
  actions: readonly RowMenuAction[];
  archived: boolean;
  deleteLabel: string;
  onDelete: () => void;
  Item: MenuItemComponent;
  Separator: ComponentType;
}) {
  return (
    <>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Item key={action.key} onClick={action.onClick}>
            <Icon aria-hidden="true" />
            {action.label}
          </Item>
        );
      })}
      {archived && (
        <>
          <Separator />
          <Item variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            {deleteLabel}
          </Item>
        </>
      )}
    </>
  );
}

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

  const rowActions: RowMenuAction[] = [
    {
      key: "openInNewTab",
      label: t("actions.openInNewTab"),
      icon: ExternalLink,
      onClick: () => openPageInNewTab(projectId, page.id),
    },
    {
      key: "copyLink",
      label: t("actions.copyLink"),
      icon: Link2,
      onClick: () => {
        void copyPageLink(projectId, page.id);
      },
    },
    {
      key: "duplicate",
      label: t("actions.makeCopy"),
      icon: Copy,
      onClick: () => {
        void duplicatePageWithToast(page);
      },
    },
    {
      key: "lock",
      label: page.isLocked ? t("actions.unlock") : t("actions.lock"),
      icon: page.isLocked ? LockOpen : Lock,
      onClick: () => {
        void togglePageLockedWithToast(page);
      },
    },
    {
      key: "archive",
      label: archived ? t("actions.restore") : t("actions.archive"),
      icon: archived ? ArchiveRestore : Archive,
      onClick: () => {
        if (archived) {
          void restorePageWithToast(page.id);
        } else {
          void archivePageWithToast(page.id);
        }
      },
    },
  ];

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
              <PageRowMenuItems
                actions={rowActions}
                archived={archived}
                deleteLabel={t("actions.delete")}
                onDelete={() => onRequestDelete(page)}
                Item={DropdownMenuItem}
                Separator={DropdownMenuSeparator}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <PageRowMenuItems
          actions={rowActions}
          archived={archived}
          deleteLabel={t("actions.delete")}
          onDelete={() => onRequestDelete(page)}
          Item={ContextMenuItem}
          Separator={ContextMenuSeparator}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
