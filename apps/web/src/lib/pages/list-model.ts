import type { Page } from "../db/schema";

export type PagesListTab = "all" | "archived";

export type PageSortKey = "name" | "createdAt" | "updatedAt";
export type PageSortDirection = "asc" | "desc";

export interface PageListSort {
  key: PageSortKey;
  direction: PageSortDirection;
}

export const PAGE_CREATED_DATE_FILTERS = [
  "today",
  "last_7_days",
  "last_14_days",
  "last_30_days",
] as const;

export type PageCreatedDateFilter = (typeof PAGE_CREATED_DATE_FILTERS)[number];

export interface PageListFilters {
  favoritesOnly: boolean;
  createdDateRange: PageCreatedDateFilter | null;
}

export const DEFAULT_PAGE_SORT: PageListSort = {
  key: "updatedAt",
  direction: "desc",
};

export const DEFAULT_PAGE_LIST_FILTERS: PageListFilters = {
  favoritesOnly: false,
  createdDateRange: null,
};

export interface FilterAndSortPagesOptions {
  tab: PagesListTab;
  searchQuery: string;
  contentTextByPageId?: ReadonlyMap<string, string>;
  sort: PageListSort;
  filters: PageListFilters;
  /** Display fallback used when searching or sorting untitled pages. */
  untitledLabel?: string;
  /** Locale passed to `Intl.Collator` for Name sorting. */
  locale?: string;
  /** Reference epoch ms for Created date filters (defaults to `Date.now()`). */
  now?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

export function parsePagesTab(value: unknown): PagesListTab {
  return value === "archived" ? "archived" : "all";
}

export function countActivePageFilters(filters: PageListFilters): number {
  let count = 0;
  if (filters.favoritesOnly) count += 1;
  if (filters.createdDateRange !== null) count += 1;
  return count;
}

export function hasActivePageFilters(filters: PageListFilters): boolean {
  return countActivePageFilters(filters) > 0;
}

function createdDateCutoff(range: PageCreatedDateFilter, now: number): number {
  switch (range) {
    case "today": {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      return startOfDay.getTime();
    }
    case "last_7_days":
      return now - 7 * MS_PER_DAY;
    case "last_14_days":
      return now - 14 * MS_PER_DAY;
    case "last_30_days":
      return now - 30 * MS_PER_DAY;
  }
}

export function filterAndSortPages(
  pages: readonly Page[],
  options: FilterAndSortPagesOptions,
): Page[] {
  const {
    tab,
    searchQuery,
    contentTextByPageId,
    sort,
    filters,
    untitledLabel = "",
    locale,
    now = Date.now(),
  } = options;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const createdCutoff =
    filters.createdDateRange !== null
      ? createdDateCutoff(filters.createdDateRange, now)
      : null;

  const filtered = pages.filter((page) => {
    const archived = page.archivedAt !== undefined;
    if (tab === "archived" ? !archived : archived) {
      return false;
    }

    if (filters.favoritesOnly && !page.isFavorite) {
      return false;
    }

    if (createdCutoff !== null && page.createdAt < createdCutoff) {
      return false;
    }

    if (normalizedQuery.length > 0) {
      const displayTitle = (page.title.trim() || untitledLabel).toLowerCase();
      if (displayTitle.includes(normalizedQuery)) {
        return true;
      }
      const bodyText = contentTextByPageId?.get(page.id);
      if (bodyText && bodyText.toLowerCase().includes(normalizedQuery)) {
        return true;
      }
      return false;
    }

    return true;
  });

  const factor = sort.direction === "asc" ? 1 : -1;
  const collator =
    sort.key === "name"
      ? new Intl.Collator(locale, { sensitivity: "base", numeric: true })
      : null;

  return filtered.sort((a, b) => {
    let primary: number;
    if (sort.key === "name" && collator) {
      const aName = a.title.trim() || untitledLabel;
      const bName = b.title.trim() || untitledLabel;
      primary = collator.compare(aName, bName);
    } else if (sort.key === "createdAt") {
      primary = a.createdAt - b.createdAt;
    } else {
      primary = a.updatedAt - b.updatedAt;
    }

    if (primary !== 0) {
      return primary * factor;
    }
    if (b.updatedAt !== a.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }
    if (b.createdAt !== a.createdAt) {
      return b.createdAt - a.createdAt;
    }
    return a.id.localeCompare(b.id);
  });
}
