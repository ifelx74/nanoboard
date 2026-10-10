import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { moveTaskToColumn } from "@/lib/db/queries";
import type { Column, Task } from "@/lib/db/schema";
import { toast } from "@/lib/toast";

export default function TaskColumnPopover({
  task,
  columns,
  children,
}: {
  task: Task;
  columns: Column[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function handleColumnChange(columnId: string) {
    const column = columns.find((candidate) => candidate.id === columnId);
    if (!column) return;
    try {
      await moveTaskToColumn(task.id, column.slug);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to move task",
      );
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <div>
          {columns.map((column) => (
            <Button
              key={column.id}
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 rounded-none px-2 first:rounded-t-md last:rounded-b-md"
              onClick={() => void handleColumnChange(column.id)}
            >
              <span className="text-sm">{column.name}</span>
              {task.columnId === column.id && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
