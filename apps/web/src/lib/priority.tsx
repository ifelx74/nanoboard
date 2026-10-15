import type { TaskPriority } from "@/lib/db/schema";
import PriorityUrgent from "@/icons/priority-urgent";
import PriorityHigh from "@/icons/priority-high";
import PriorityMedium from "@/icons/priority-medium";
import PriorityLow from "@/icons/priority-low";
import PriorityNone from "@/icons/priority-none";
import { cn } from "./utils";

export function priorityLabel(priority: TaskPriority): string {
  return priority
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function getPriorityIcon(priority: TaskPriority, className?: string) {
  const icons = {
    urgent: PriorityUrgent,
    high: PriorityHigh,
    medium: PriorityMedium,
    low: PriorityLow,
    "no-priority": PriorityNone,
  };

  const Icon = icons[priority ?? "no-priority"] ?? PriorityNone;

  if (!Icon) return null;

  return (
    <Icon
      className={cn(
        "shrink-0 size-4!",
        {
          "text-destructive": priority === "urgent",
          "text-warning-foreground": priority === "high",
          "text-warning-foreground/80": priority === "medium",
          "text-info-foreground/85": priority === "low",
          "text-muted-foreground": priority === "no-priority",
        },
        className,
      )}
    />
  );
}
