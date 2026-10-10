import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateTaskPriority } from "@/lib/db/queries";
import type { Task, TaskPriority } from "@/lib/db/schema";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";

const priorityOptions: TaskPriority[] = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
];

function priorityLabel(priority: TaskPriority): string {
  return priority
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export default function TaskPriorityPopover({
  task,
  children,
}: {
  task: Task;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function handlePriorityChange(priority: TaskPriority) {
    try {
      await updateTaskPriority(task.id, priority);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update priority",
      );
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <div>
          {priorityOptions.map((priority) => (
            <Button
              key={priority}
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 rounded-none px-2 first:rounded-t-md last:rounded-b-md"
              onClick={() => void handlePriorityChange(priority)}
            >
              {getPriorityIcon(priority)}
              <span className="text-sm capitalize">
                {priorityLabel(priority)}
              </span>
              {task.priority === priority && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
