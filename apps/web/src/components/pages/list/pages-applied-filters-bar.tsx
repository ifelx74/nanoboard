import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_PAGE_LIST_FILTERS,
  hasActivePageFilters,
  type PageCreatedDateFilter,
  type PageListFilters,
} from "@/lib/pages/list-model";

type PagesAppliedFiltersBarProps = {
  filters: PageListFilters;
  onChange: (nextFilters: PageListFilters) => void;
};

export function PagesAppliedFiltersBar({
  filters,
  onChange,
}: PagesAppliedFiltersBarProps) {
  const { t } = useTranslation("pages");

  if (!hasActivePageFilters(filters)) return null;

  function labelForDateRange(range: PageCreatedDateFilter): string {
    switch (range) {
      case "today":
        return t("list.filters.ranges.today");
      case "last_7_days":
        return t("list.filters.ranges.last7Days");
      case "last_14_days":
        return t("list.filters.ranges.last14Days");
      case "last_30_days":
        return t("list.filters.ranges.last30Days");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-background px-4 py-2">
      {filters.favoritesOnly && (
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("list.filters.favorites")}
          </span>
          <button
            type="button"
            aria-label={t("list.filters.removeFilter")}
            onClick={() => onChange({ ...filters, favoritesOnly: false })}
            className="inline-flex size-4 cursor-pointer items-center justify-center rounded-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      )}

      {filters.createdDateRange !== null && (
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
          <span>{t("list.filters.createdDate")}:</span>
          <span className="font-medium text-foreground">
            {labelForDateRange(filters.createdDateRange)}
          </span>
          <button
            type="button"
            aria-label={t("list.filters.removeFilter")}
            onClick={() => onChange({ ...filters, createdDateRange: null })}
            className="inline-flex size-4 cursor-pointer items-center justify-center rounded-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={() => onChange(DEFAULT_PAGE_LIST_FILTERS)}
        className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span>{t("list.filters.clearAll")}</span>
        <X className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}
