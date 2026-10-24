import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";
import type { Sticky } from "@/lib/db/schema";
import { MasonryItem } from "./masonry";
import { StickyCard } from "./sticky-card";
import { cn } from "@/lib/utils";

// Memoized so a search keystroke (which re-renders the layout) skips every
// card whose sticky is unchanged.
export const SortableStickyCard = memo(function SortableStickyCard({
  sticky,
  maxEditorHeight,
}: {
  sticky: Sticky;
  maxEditorHeight?: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sticky.id });

  return (
    <MasonryItem
      id={sticky.id}
      itemRef={setNodeRef}
      className={cn(
        "transition-opacity duration-200",
        isDragging && "opacity-25",
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <StickyCard
        sticky={sticky}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        maxEditorHeight={maxEditorHeight}
      />
    </MasonryItem>
  );
});
