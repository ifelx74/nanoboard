import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableMeasuring,
  type MeasuringConfiguration,
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
import { reorderStickies, stickySearchIndex } from "@/lib/db/stickies";
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

// dnd-kit measures drag sources and droppables "transform-agnostically" by
// default: it cancels the element's own CSS transform before reporting the
// rect. Masonry positions cells via transform, so that default measures every
// cell at the grid origin — the drag preview would jump to the first column
// and collision rects would all stack up. Measure the real on-screen rects.
const measureViewportRect: DraggableMeasuring["measure"] = (element) => {
  const { top, left, right, bottom, width, height } =
    element.getBoundingClientRect();
  return { top, left, right, bottom, width, height };
};

const measuring: MeasuringConfiguration = {
  draggable: { measure: measureViewportRect },
  droppable: { measure: measureViewportRect },
};

export function StickiesLayout({
  stickies,
  searchQuery = "",
  onAddSticky,
  isCreating = false,
}: Props) {
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

  // Search stays live: the text index is memoized on the stickies array so
  // each keystroke is an includes() per note, not an HTML re-extraction.
  const searchIndex = useMemo(() => stickySearchIndex(stickies), [stickies]);

  const filteredStickies = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return stickies;
    return stickies.filter((sticky) =>
      searchIndex.get(sticky.id)?.includes(query),
    );
  }, [stickies, searchIndex, searchQuery]);

  const filteredIds = useMemo(
    () => filteredStickies.map((sticky) => sticky.id),
    [filteredStickies],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id;
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
      <div className="flex items-center justify-center h-full">
        <EmptyStickiesState onAddSticky={onAddSticky} isCreating={isCreating} />
      </div>
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
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={filteredIds} strategy={rectSortingStrategy}>
        <MasonryGrid itemIds={filteredIds}>
          {filteredStickies.map((sticky) => (
            <SortableStickyCard
              key={sticky.id}
              sticky={sticky}
              maxEditorHeight={588}
            />
          ))}
        </MasonryGrid>
      </SortableContext>

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
