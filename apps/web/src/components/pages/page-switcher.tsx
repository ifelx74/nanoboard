import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Page } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { PageLogoIcon } from "./page-logo";

type PageSwitcherProps = {
  projectId: string;
  currentPage: Page;
  /** Optional live title override while editing before autosave flushes. */
  displayTitle?: string;
  pages: Page[];
};

/**
 * Searchable breadcrumb page switcher dropdown (`Project / [Pages ▾] / [Page ▾]`).
 * Uses Popover rather than DropdownMenu so typing in the filter input works
 * without menu typeahead hijacking keystrokes.
 */
export function PageSwitcher({
  projectId,
  currentPage,
  displayTitle,
  pages,
}: PageSwitcherProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("pages");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const activeTitle =
    (displayTitle ?? currentPage.title).trim() || t("untitled");

  const filteredPages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return pages;
    return pages.filter((page) => {
      const label =
        (page.id === currentPage.id
          ? (displayTitle ?? page.title)
          : page.title
        ).trim() || t("untitled");
      return label.toLowerCase().includes(normalized);
    });
  }, [pages, query, currentPage.id, displayTitle, t]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
    }
  }

  function handleSelect(targetPageId: string) {
    setOpen(false);
    setQuery("");
    if (targetPageId === currentPage.id) return;
    void navigate({
      to: "/project/$projectId/pages/$pageId",
      params: { projectId, pageId: targetPageId },
    });
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("switcher.ariaLabel")}
            className="max-w-44 gap-1.5 px-1.5 py-0.5 text-sm font-medium text-foreground sm:max-w-64"
          >
            <PageLogoIcon
              logo={currentPage.logo}
              className="size-3.5 shrink-0"
              emojiClassName="size-3.5 text-xs"
            />
            <span className="truncate">{activeTitle}</span>
            <ChevronsUpDown className="size-3 shrink-0 text-foreground/70" />
          </Button>
        }
      />
      <PopoverContent align="start" side="bottom" className="w-64 p-1.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1">
            <Search
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("switcher.searchPlaceholder")}
              autoFocus
              className="w-full min-w-0 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-0.5">
            {filteredPages.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {t("switcher.empty")}
              </p>
            ) : (
              filteredPages.map((page) => {
                const isCurrent = page.id === currentPage.id;
                const label =
                  (isCurrent
                    ? (displayTitle ?? page.title)
                    : page.title
                  ).trim() || t("untitled");
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => handleSelect(page.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground",
                      isCurrent && "bg-accent/60 font-medium text-foreground",
                    )}
                  >
                    <PageLogoIcon
                      logo={page.logo}
                      className="size-3.5 shrink-0"
                      emojiClassName="size-3.5 text-xs"
                    />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {isCurrent && (
                      <Check
                        className="size-3.5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
