import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import type { Sticky } from "@/lib/db/schema";
import { reorderStickies } from "@/lib/db/stickies";
import { EmptySearchState, EmptyStickiesState } from "./empty-states";
import { MasonryGrid } from "./masonry";
import { SortableStickyCard } from "./sortable-sticky-card";
import { StickyCard } from "./sticky-card";

type Props = {
  stickies: Sticky[];
  searchQuery?: string;
  onAddSticky: () => void;
  isCreating?: boolean;
};

export function StickiesLayout({
  stickies,
  searchQuery = "",
  onAddSticky,
  isCreating = false,
}: Props) {
  // Plane renders the preview from a snapshot taken at drag start.
  const [activeSticky, setActiveSticky] = useState<Sticky | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const filteredStickies = useMemo(() => {
    if (!searchQuery.trim()) return stickies;
    const query = searchQuery.toLowerCase().trim();
    return stickies.filter((sticky) => {
      const textContent = sticky.contentHtml.replace(/<[^>]*>/g, " ");
      return textContent.toLowerCase().includes(query);
    });
  }, [stickies, searchQuery]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id.toString();
    setActiveSticky(stickies.find((sticky) => sticky.id === id) ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSticky(null);
    if (!over || active.id === over.id) return;

    try {
      await reorderStickies(active.id.toString(), over.id.toString());
    } catch (error) {
      console.error("Failed to reorder stickies:", error);
    }
  };

  const handleDragCancel = () => {
    setActiveSticky(null);
  };

  if (stickies.length === 0) {
    return (
      <EmptyStickiesState onAddSticky={onAddSticky} isCreating={isCreating} />
    );
  }

  if (filteredStickies.length === 0 && searchQuery.trim() !== "") {
    return (
      <EmptySearchState onAddSticky={onAddSticky} isCreating={isCreating} />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={filteredStickies.map((s) => s.id)}
        strategy={rectSortingStrategy}
      >
        <MasonryGrid itemIds={filteredStickies.map((s) => s.id)}>
          {filteredStickies.map((sticky) => (
            <SortableStickyCard
              key={sticky.id}
              sticky={sticky}
              maxEditorHeight={588}
            />
          ))}
        </MasonryGrid>
      </SortableContext>

      {/* Plane's drag preview is a full-size snapshot of the note rendered
          through the browser's native drag-image API. dnd-kit renders the
          overlay directly, so painting the card at full size reproduces it. */}
      <DragOverlay dropAnimation={null}>
        {activeSticky ? (
          <div className="m-2">
            <StickyCard sticky={activeSticky} showToolbar={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
