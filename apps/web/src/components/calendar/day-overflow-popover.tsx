import { type JSX, useState } from "react";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CalendarTask } from "./calendar-task-bar";

type DayOverflowPopoverProps = {
  day: Date;
  /** Every task on this day, not just the ones the lane cap hid. */
  tasks: CalendarTask[];
  hiddenCount: number;
  onOpenTask: (taskId: string) => void;
};

export default function DayOverflowPopover({
  day,
  tasks,
  hiddenCount,
  onOpenTask,
}: DayOverflowPopoverProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const dayLabel = format(day, "EEEE, MMMM d");

  const handleSelectTask = (taskId: string) => {
    setOpen(false);
    onOpenTask(taskId);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={`Tasks on ${dayLabel}`}
        className="w-full truncate rounded-sm px-1.5 pb-1 text-left text-[10px] leading-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        +{hiddenCount} more
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="space-y-1">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {dayLabel}
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => handleSelectTask(task.id)}
                className="flex w-full min-w-0 flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="w-full truncate text-xs font-medium text-foreground">
                  {task.title}
                </span>
                <span className="w-full truncate text-[11px] text-muted-foreground">
                  Due {format(task.scheduleStart, "MMM d")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
