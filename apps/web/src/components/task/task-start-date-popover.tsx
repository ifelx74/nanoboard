import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateTaskStartDate } from "@/lib/db/queries";
import type { StartDateString, Task } from "@/lib/db/schema";
import { startDate as startDateString } from "@/lib/db/schema";
import { parseDayString, toDayString } from "@/lib/due-date-status";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";

function toISODate(date: Date): StartDateString {
  return startDateString(toDayString(date));
}

function parseStartDate(startDate: StartDateString): Date {
  return parseDayString(startDate);
}

function parseDueDate(dueDate: NonNullable<Task["dueDate"]>): Date {
  return parseDayString(dueDate);
}

export default function TaskStartDatePopover({
  task,
  disabled = false,
  children,
}: {
  task: Task;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("task");
  const [open, setOpen] = useState(false);

  async function handleDateChange(date: Date | undefined) {
    try {
      await updateTaskStartDate(task.id, date ? toISODate(date) : null);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("task:dates.startDateError"),
      );
    }
  }

  if (disabled) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={task.startDate ? parseStartDate(task.startDate) : undefined}
          onSelect={(date) => void handleDateChange(date)}
          disabled={
            task.dueDate ? { after: parseDueDate(task.dueDate) } : undefined
          }
          className="w-full bg-popover"
        />
        {task.startDate && (
          <div className="border-t border-border pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => void handleDateChange(undefined)}
            >
              <X className="h-4 w-4" />
              {t("dates.clearStartDate")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
