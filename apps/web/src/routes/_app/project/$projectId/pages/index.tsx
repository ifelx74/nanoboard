import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Archive, FileText, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ProjectLayout } from "@/components/common/project-layout";
import { PagesAppliedFiltersBar } from "@/components/pages/list/pages-applied-filters-bar";
import { PagesFiltersPopover } from "@/components/pages/list/pages-filters-popover";
import { PagesListRow } from "@/components/pages/list/pages-list-row";
import { PagesSearchInput } from "@/components/pages/list/pages-search-input";
import { PagesSortDropdown } from "@/components/pages/list/pages-sort-dropdown";
import { PageDeleteDialog } from "@/components/pages/page-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { db } from "@/lib/db/db";
import {
  createPage,
  listProjectPageContentTexts,
  listProjectPages,
} from "@/lib/db/pages";
import { getProject } from "@/lib/db/queries";
import type { Page } from "@/lib/db/schema";
import { getActiveLocale } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import {
  DEFAULT_PAGE_LIST_FILTERS,
  DEFAULT_PAGE_SORT,
  filterAndSortPages,
  hasActivePageFilters,
  parsePagesTab,
  type PageListFilters,
  type PageListSort,
  type PagesListTab,
} from "@/lib/pages/list-model";
import { projectRouteHead } from "@/lib/seo";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/project/$projectId/pages/")({
  component: RouteComponent,
  loader: ({ params }) => getProject(params.projectId).catch(() => undefined),
  head: projectRouteHead("pages"),
  // Keep validateSearch inline so the route tree never pulls `list-model.ts`
  // into the initial app-shell bundle.
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: PagesListTab } => ({
    tab:
      search.tab === "archived"
        ? "archived"
        : search.tab === "all"
          ? "all"
          : undefined,
  }),
});

function PagesListSkeleton() {
  return (
    <div className="h-full overflow-auto bg-background" aria-hidden="true">
      {["skeleton-row-0", "skeleton-row-1", "skeleton-row-2"].map((key) => (
        <div
          key={key}
          className="flex min-h-[52px] items-center gap-3 border-b border-border/60 px-4 py-2"
        >
          <div className="size-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { tab: rawTab } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useTranslation("pages");

  const activeTab = parsePagesTab(rawTab);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<PageListSort>(DEFAULT_PAGE_SORT);
  const [filters, setFilters] = useState<PageListFilters>(
    DEFAULT_PAGE_LIST_FILTERS,
  );
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);

  useEffect(() => {
    setSearchQuery("");
    setFilters(DEFAULT_PAGE_LIST_FILTERS);
    setDeleteTarget(null);
  }, [projectId]);

  const pages = useLiveQuery(
    () => listProjectPages(db, projectId),
    [projectId],
  );

  // Scan `pageContents` on demand ONLY while a non-empty search query is entered
  // so idle list loads never structured-clone document bodies.
  const isSearchActive = searchQuery.trim().length > 0;
  const contentTextByPageId = useLiveQuery(async () => {
    if (!isSearchActive) return undefined;
    return listProjectPageContentTexts(db, projectId);
  }, [projectId, isSearchActive]);

  const untitledLabel = t("untitled");
  const activeLocale = getActiveLocale();

  const visiblePages = useMemo(() => {
    if (!pages) return [];
    return filterAndSortPages(pages, {
      tab: activeTab,
      searchQuery,
      contentTextByPageId,
      sort,
      filters,
      untitledLabel,
      locale: activeLocale,
    });
  }, [
    pages,
    activeTab,
    searchQuery,
    contentTextByPageId,
    sort,
    filters,
    untitledLabel,
    activeLocale,
  ]);

  function handleTabChange(nextTab: PagesListTab) {
    if (nextTab === activeTab) return;
    void navigate({
      to: "/project/$projectId/pages",
      params: { projectId },
      search: { tab: nextTab },
    });
  }

  async function handleCreatePage() {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const pageId = await createPage(db, projectId);
      void navigate({
        to: "/project/$projectId/pages/$pageId",
        params: { projectId, pageId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("pages:list.errors.create"),
      );
    } finally {
      setIsCreating(false);
    }
  }

  const addPageButton = (
    <Button
      size="sm"
      disabled={isCreating}
      onClick={() => void handleCreatePage()}
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {t("list.addPage")}
    </Button>
  );

  const hasSearchOrFilters = isSearchActive || hasActivePageFilters(filters);

  return (
    <ProjectLayout
      projectId={projectId}
      activeView="pages"
      headerActions={addPageButton}
    >
      {pages === undefined ? (
        <PagesListSkeleton />
      ) : pages.length === 0 ? (
        <div className="flex h-full items-center justify-center bg-background p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12">
                <FileText className="size-6" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("list.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("list.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                disabled={isCreating}
                onClick={() => void handleCreatePage()}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t("list.addPage")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col overflow-hidden bg-background">
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <div
              role="tablist"
              aria-label={t("list.tabs.ariaLabel")}
              className="flex h-full items-center gap-1"
            >
              {(["all", "archived"] as const).map((tabKey) => {
                const isSelected = activeTab === tabKey;
                const label =
                  tabKey === "all"
                    ? t("list.tabs.all")
                    : t("list.tabs.archived");
                return (
                  <button
                    key={tabKey}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleTabChange(tabKey)}
                    className={cn(
                      "relative flex h-full cursor-pointer items-center px-3 text-[13px] font-medium transition-colors outline-none focus-visible:text-foreground",
                      isSelected
                        ? "text-brand-800 dark:text-brand-300"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{label}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-x-0 bottom-0 h-0.5 rounded-t transition-colors",
                        isSelected
                          ? "bg-brand-800 dark:bg-brand-400"
                          : "bg-transparent",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <PagesSearchInput value={searchQuery} onChange={setSearchQuery} />
              <PagesSortDropdown sort={sort} onChange={setSort} />
              <PagesFiltersPopover filters={filters} onChange={setFilters} />
            </div>
          </div>

          <PagesAppliedFiltersBar filters={filters} onChange={setFilters} />

          {visiblePages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-6">
              {hasSearchOrFilters ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon" className="size-12">
                      <Search className="size-6" aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("list.noMatchesTitle")}</EmptyTitle>
                    <EmptyDescription>
                      {t("list.noMatchesDescription")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : activeTab === "archived" ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon" className="size-12">
                      <Archive className="size-6" aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("list.archivedEmptyTitle")}</EmptyTitle>
                    <EmptyDescription>
                      {t("list.archivedEmptyDescription")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon" className="size-12">
                      <FileText className="size-6" aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("list.emptyTitle")}</EmptyTitle>
                    <EmptyDescription>
                      {t("list.emptyDescription")}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      size="sm"
                      disabled={isCreating}
                      onClick={() => void handleCreatePage()}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      {t("list.addPage")}
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {visiblePages.map((page) => (
                <PagesListRow
                  key={page.id}
                  projectId={projectId}
                  page={page}
                  onRequestDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <PageDeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          pageId={deleteTarget.id}
          pageTitle={deleteTarget.title}
          onDeleted={() => setDeleteTarget(null)}
        />
      )}
    </ProjectLayout>
  );
}
