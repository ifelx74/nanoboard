import {
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  CircleAlert,
  Minus,
} from "lucide-react";
import type { TaskPriority } from "@/lib/db/schema";

export function priorityLabel(priority: TaskPriority): string {
  return priority
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function getPriorityIcon(priority: string) {
  switch (priority) {
    case "urgent":
      return (
        <CircleAlert className="h-4! w-4! text-destructive-foreground" />
      );
    case "high":
      return (
        <ChevronsUp className="h-4! w-4! text-warning-foreground" />
      );
    case "medium":
      return (
        <ChevronUp className="size-4! text-warning-foreground/80" />
      );
    case "low":
      return (
        <ChevronDown className="size-4! text-info-foreground/85" />
      );
    case "no-priority":
      return <Minus className="size-4! text-muted-foreground" />;
    default:
      return <Minus className="size-4! text-muted-foreground" />;
  }
}
