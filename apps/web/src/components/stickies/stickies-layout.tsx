import {
  closestCenter,
  DndContext,
  type DragEndEvent,
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
import { useMemo } from "react";
import type { Sticky } from "@/lib/db/schema";
import { reorderStickies } from "@/lib/db/stickies";
import { EmptySearchState, EmptyStickiesState } from "./empty-states";
import { SortableStickyCard } from "./sortable-sticky-card";

type Props = {
  stickies: Sticky[];
  searchQuery?: string;
  onAddSticky?: () => void;
  onClearSearch?: () => void;
  isCreating?: boolean;
};

export function StickiesLayout({
  stickies,
  searchQuery = "",
  onAddSticky,
  onClearSearch,
  isCreating = false,
}: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
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
      // Strip HTML tags for clean text matching
      const textContent = sticky.contentHtml.replace(/<[^>]*>/g, " ");
      return textContent.toLowerCase().includes(query);
    });
  }, [stickies, searchQuery]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    try {
      await reorderStickies(active.id.toString(), over.id.toString());
    } catch (error) {
      console.error("Failed to reorder stickies:", error);
    }
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
      <EmptySearchState onClearSearch={onClearSearch ?? (() => {})} />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={filteredStickies.map((s) => s.id)}
        strategy={rectSortingStrategy}
      >
        <div className="w-full columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 [&>*]:break-inside-avoid">
          {filteredStickies.map((sticky) => (
            <SortableStickyCard key={sticky.id} sticky={sticky} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
