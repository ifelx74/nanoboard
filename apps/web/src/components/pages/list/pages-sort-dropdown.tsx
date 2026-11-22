import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  PageListSort,
  PageSortDirection,
  PageSortKey,
} from "@/lib/pages/list-model";

type PagesSortDropdownProps = {
  sort: PageListSort;
  onChange: (nextSort: PageListSort) => void;
};

export function PagesSortDropdown({ sort, onChange }: PagesSortDropdownProps) {
  const { t } = useTranslation("pages");

  const keyOptions: { value: PageSortKey; label: string }[] = [
    { value: "name", label: t("list.sort.name") },
    { value: "createdAt", label: t("list.sort.createdAt") },
    { value: "updatedAt", label: t("list.sort.updatedAt") },
  ];

  const directionOptions: { value: PageSortDirection; label: string }[] = [
    { value: "asc", label: t("list.sort.asc") },
    { value: "desc", label: t("list.sort.desc") },
  ];

  const activeLabel =
    keyOptions.find((option) => option.value === sort.key)?.label ??
    t("list.sort.updatedAt");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("list.sort.ariaLabel")}
            className="h-7 gap-1.5 px-2.5 text-xs font-medium"
          >
            {sort.direction === "asc" ? (
              <ArrowUpNarrowWide className="size-3.5" aria-hidden="true" />
            ) : (
              <ArrowDownWideNarrow className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{activeLabel}</span>
            <ChevronDown
              className="size-3 text-muted-foreground"
              aria-hidden="true"
            />
          </Button>
        }
      />
      <DropdownMenuContent align="end" side="bottom" className="w-44">
        {keyOptions.map((option) => {
          const isSelected = sort.key === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange({ ...sort, key: option.value })}
              className="justify-between text-xs"
            >
              <span>{option.label}</span>
              {isSelected && (
                <Check className="size-3.5 text-primary" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {directionOptions.map((option) => {
          const isSelected = sort.direction === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange({ ...sort, direction: option.value })}
              className="justify-between text-xs"
            >
              <span>{option.label}</span>
              {isSelected && (
                <Check className="size-3.5 text-primary" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
