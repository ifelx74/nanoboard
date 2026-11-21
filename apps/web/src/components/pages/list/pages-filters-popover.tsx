import { Check, ChevronDown, ListFilter, Search, Star } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  countActivePageFilters,
  type PageCreatedDateFilter,
  type PageListFilters,
} from "@/lib/pages/list-model";
import { cn } from "@/lib/utils";

type PagesFiltersPopoverProps = {
  filters: PageListFilters;
  onChange: (nextFilters: PageListFilters) => void;
};

export function PagesFiltersPopover({
  filters,
  onChange,
}: PagesFiltersPopoverProps) {
  const { t } = useTranslation("pages");
  const [open, setOpen] = useState(false);
  const [optionQuery, setOptionQuery] = useState("");
  const [createdDateOpen, setCreatedDateOpen] = useState(true);

  const activeCount = countActivePageFilters(filters);
  const normalizedQuery = optionQuery.trim().toLowerCase();

  const favoritesLabel = t("list.filters.favorites");
  const createdDateLabel = t("list.filters.createdDate");
  const dateOptions: { value: PageCreatedDateFilter; label: string }[] = [
    { value: "today", label: t("list.filters.ranges.today") },
    { value: "last_7_days", label: t("list.filters.ranges.last7Days") },
    { value: "last_14_days", label: t("list.filters.ranges.last14Days") },
    { value: "last_30_days", label: t("list.filters.ranges.last30Days") },
  ];

  const showFavorites =
    normalizedQuery.length === 0 ||
    favoritesLabel.toLowerCase().includes(normalizedQuery);

  const matchingDateOptions =
    normalizedQuery.length === 0 ||
    createdDateLabel.toLowerCase().includes(normalizedQuery)
      ? dateOptions
      : dateOptions.filter((option) =>
          option.label.toLowerCase().includes(normalizedQuery),
        );

  const showCreatedDate = matchingDateOptions.length > 0;
  const noOptionsMatch = !showFavorites && !showCreatedDate;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setOptionQuery("");
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs font-medium"
          >
            <ListFilter className="size-3.5" aria-hidden="true" />
            <span>{t("list.filters.button")}</span>
            {activeCount > 0 && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-brand-800 text-[10px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" side="bottom" className="w-64 p-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1">
            <Search
              className="size-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={optionQuery}
              onChange={(event) => setOptionQuery(event.target.value)}
              placeholder={t("list.filters.searchPlaceholder")}
              className="w-full min-w-0 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          {noOptionsMatch ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t("list.filters.empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {showFavorites && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={filters.favoritesOnly}
                  onClick={() =>
                    onChange({
                      ...filters,
                      favoritesOnly: !filters.favoritesOnly,
                    })
                  }
                  className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                >
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <Star
                      className={cn(
                        "size-3.5 text-muted-foreground",
                        filters.favoritesOnly &&
                          "fill-amber-400 text-amber-500",
                      )}
                      aria-hidden="true"
                    />
                    {favoritesLabel}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-4 place-items-center rounded-xs border transition-colors",
                      filters.favoritesOnly
                        ? "border-brand-800 bg-brand-800 text-white"
                        : "border-input bg-background",
                    )}
                  >
                    {filters.favoritesOnly && <Check className="size-3" />}
                  </span>
                </button>
              )}

              {showFavorites && showCreatedDate && (
                <div className="my-0.5 h-px bg-border" />
              )}

              {showCreatedDate && (
                <Collapsible
                  open={createdDateOpen}
                  onOpenChange={setCreatedDateOpen}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                    <span>{createdDateLabel}</span>
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-150",
                        createdDateOpen && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1 flex flex-col gap-0.5 pl-1">
                      {matchingDateOptions.map((option) => {
                        const selected =
                          filters.createdDateRange === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            onClick={() =>
                              onChange({
                                ...filters,
                                createdDateRange: selected
                                  ? null
                                  : option.value,
                              })
                            }
                            className={cn(
                              "flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                              selected
                                ? "bg-accent/60 font-medium text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <span>{option.label}</span>
                            {selected && (
                              <Check
                                className="size-3.5 text-brand-800 dark:text-brand-400"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
