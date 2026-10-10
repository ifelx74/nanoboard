import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateTaskDueDate } from "@/lib/db/queries";
import type { DueDateString, Task } from "@/lib/db/schema";
import { toast } from "@/lib/toast";

function toISODate(date: Date): DueDateString {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` as DueDateString;
}

function parseDueDate(dueDate: DueDateString): Date {
  const [year, month, day] = dueDate.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day);
}

export default function TaskDueDatePopover({
  task,
  children,
}: {
  task: Task;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function handleDateChange(date: Date | undefined) {
    try {
      await updateTaskDueDate(task.id, date ? toISODate(date) : null);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update due date",
      );
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={task.dueDate ? parseDueDate(task.dueDate) : undefined}
          onSelect={(date) => void handleDateChange(date)}
          className="w-full bg-popover"
        />
        {task.dueDate && (
          <div className="border-t border-border pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => void handleDateChange(undefined)}
            >
              <X className="h-4 w-4" />
              Clear due date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
