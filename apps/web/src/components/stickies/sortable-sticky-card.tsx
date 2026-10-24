import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Sticky } from "@/lib/db/schema";
import { MasonryItem } from "./masonry";
import { StickyCard } from "./sticky-card";
import { cn } from "@/lib/utils";

export function SortableStickyCard({
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
}
