import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
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
  onAddSticky?: () => void;
  isCreating?: boolean;
};

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.4",
      },
    },
  }),
  duration: 250,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
};

export function StickiesLayout({
  stickies,
  searchQuery = "",
  onAddSticky,
  isCreating = false,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const activeSticky = useMemo(
    () => (activeId ? stickies.find((s) => s.id === activeId) : null),
    [activeId, stickies],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    try {
      await reorderStickies(active.id.toString(), over.id.toString());
    } catch (error) {
      console.error("Failed to reorder stickies:", error);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  if (stickies.length === 0) {
    return (
      <EmptyStickiesState
        onAddSticky={onAddSticky ?? (() => {})}
        isCreating={isCreating}
      />
    );
  }

  if (filteredStickies.length === 0 && searchQuery.trim() !== "") {
    return (
      <EmptySearchState
        onAddSticky={onAddSticky ?? (() => {})}
        isCreating={isCreating}
      />
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

      {/* Plane's miniature drag preview: the note is scaled down to 50% and
          capped at 150px so it reads as a thumbnail rather than a full card. */}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeSticky ? (
          <div className="origin-top-left scale-50">
            <div className="-m-2 max-h-[150px] w-[290px]">
              <StickyCard sticky={activeSticky} showToolbar={false} />
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
