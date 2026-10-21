import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Sticky } from "@/lib/db/schema";
import { StickyCard } from "./sticky-card";

export function SortableStickyCard({ sticky }: { sticky: Sticky }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sticky.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-4 box-border break-inside-avoid p-[2px]"
    >
      <StickyCard
        sticky={sticky}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}
