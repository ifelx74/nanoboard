import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { BoardFilterSubjectDef } from "./use-board-filter-subjects";

export function BoardActiveFiltersBar({
  subjects,
  searchQuery = "",
  onClearSearch,
  onClearAll,
}: {
  subjects: BoardFilterSubjectDef[];
  searchQuery?: string;
  onClearSearch?: () => void;
  onClearAll: () => void;
}) {
  const { t } = useTranslation("board");
  const active = subjects.filter((subject) => subject.selected.length > 0);
  const query = searchQuery.trim();
  const searching = query !== "" && onClearSearch !== undefined;
  if (active.length === 0 && !searching) return null;

  const labelFor = (subject: BoardFilterSubjectDef, value: string) =>
    subject.options.find((option) => option.value === value)?.label ?? value;

  return (
    <section
      aria-label={t("activeFilters.label")}
      className="flex shrink-0 items-start gap-2 px-4 pt-2"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {searching && (
          <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-1.5 text-xs text-foreground">
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">
                {t("activeFilters.searchPrefix")}{" "}
              </span>
              {query}
            </span>
            <button
              type="button"
              onClick={onClearSearch}
              aria-label={t("activeFilters.clearSearchFor", { query })}
              className="flex shrink-0 items-center rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        )}
        {active.flatMap((subject) =>
          subject.selected.map((value) => (
            <span
              key={`${subject.id}:${value}`}
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
            >
              {subject.negated && (
                <span className="shrink-0 text-muted-foreground">
                  {t("activeFilters.not")}
                </span>
              )}
              <span className="min-w-0 truncate">
                {labelFor(subject, value)}
              </span>
              <button
                type="button"
                onClick={() => subject.onToggle(value)}
                aria-label={t("activeFilters.removeFilter", {
                  label: labelFor(subject, value),
                  subject: subject.label,
                })}
                className="flex shrink-0 items-center rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          )),
        )}
      </div>
      <Button
        variant="ghost"
        size="xs"
        onClick={onClearAll}
        className="h-7 shrink-0"
      >
        {t("activeFilters.clearAll")}
      </Button>
    </section>
  );
}
