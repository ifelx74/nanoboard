import {
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleDot,
  ScanSearch,
} from "lucide-react";
import type { ColumnSlug } from "@/lib/db/schema";
import { cn } from "./utils";

export function getColumnIcon(slug: ColumnSlug, isFinal = false) {
  const className = "h-4 w-4 text-muted-foreground";
  switch (slug) {
    case "backlog":
      return <CircleDashed className={className} aria-hidden="true" />;
    case "to-do":
      return <Circle className={className} aria-hidden="true" />;
    case "in-progress":
      return (
        <CircleDot
          className={cn(className, "text-yellow-500 dark:text-yellow-400")}
          aria-hidden="true"
        />
      );
    case "in-review":
      return (
        <ScanSearch
          className={cn(className, "text-blue-500 dark:text-blue-400")}
          aria-hidden="true"
        />
      );
    case "done":
      return (
        <CheckCircle2
          className={cn(className, "text-green-500 dark:text-green-400")}
          aria-hidden="true"
        />
      );
    default:
      return isFinal ? (
        <CheckCircle2
          className={cn(className, "text-green-500 dark:text-green-400")}
          aria-hidden="true"
        />
      ) : (
        <Circle className={className} aria-hidden="true" />
      );
  }
}
