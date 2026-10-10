import {
  CheckCircle2,
  Circle,
  CircleDot,
  Search,
} from "lucide-react";
import type { ColumnSlug } from "@/lib/db/schema";

/**
 * Column icon by slug, mirroring Kaneo's defaults (`to-do` Circle,
 * `in-progress` CircleDot, `in-review` Search, `done` CheckCircle2).
 * Unknown slugs fall back to the final/open glyph — Kaneo's own fallback
 * when no custom icon is set.
 */
export function getColumnIcon(slug: ColumnSlug, isFinal = false) {
  const className = "h-4 w-4 text-muted-foreground";
  switch (slug) {
    case "to-do":
      return <Circle className={className} aria-hidden="true" />;
    case "in-progress":
      return <CircleDot className={className} aria-hidden="true" />;
    case "in-review":
      return <Search className={className} aria-hidden="true" />;
    case "done":
      return <CheckCircle2 className={className} aria-hidden="true" />;
    default:
      return isFinal ? (
        <CheckCircle2 className={className} aria-hidden="true" />
      ) : (
        <Circle className={className} aria-hidden="true" />
      );
  }
}
