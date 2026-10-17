import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";

type CalendarToolbarProps = {
  visibleMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

export default function CalendarToolbar({
  visibleMonth,
  onPreviousMonth,
  onNextMonth,
  onToday,
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
