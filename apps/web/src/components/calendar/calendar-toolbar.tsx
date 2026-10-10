import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WeekStartsOnPreference } from "./use-week-starts-on";

type CalendarToolbarProps = {
  visibleMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  weekStartsOn: WeekStartsOnPreference;
  onWeekStartsOnChange: (next: WeekStartsOnPreference) => void;
};

const WEEK_START_OPTIONS: { value: WeekStartsOnPreference; label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 6, label: "Sat" },
];

export default function CalendarToolbar({
  visibleMonth,
  onPreviousMonth,
  onNextMonth,
  onToday,
  weekStartsOn,
  onWeekStartsOnChange,
}: CalendarToolbarProps): JSX.Element {
  return (
    <div className="border-b border-border/80 px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-foreground">
            Calendar
          </h1>
          <span
            className="truncate text-sm text-muted-foreground"
            data-testid="calendar-month-label"
          >
            {format(visibleMonth, "MMMM yyyy")}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <div
            role="group"
            aria-label="Week starts on"
            className="mr-1 flex items-center gap-0.5"
          >
            {WEEK_START_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={weekStartsOn === option.value}
                onClick={() => onWeekStartsOnChange(option.value)}
                className={cn(
                  "rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
                  weekStartsOn === option.value
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon-xs"
            className="min-h-11 touch-manipulation sm:min-h-0"
            aria-label="Previous month"
            onClick={onPreviousMonth}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="xs"
            className="min-h-11 touch-manipulation sm:min-h-0"
            onClick={onToday}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            className="min-h-11 touch-manipulation sm:min-h-0"
            aria-label="Next month"
            onClick={onNextMonth}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
