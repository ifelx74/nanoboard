import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  DragOverlay,
  type DropAnimation,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  QUICK_ADD_TITLE_MAX,
  QUICK_ADD_TITLE_MIN,
  createTask,
  reorderTasks,
} from "@/lib/db/queries";
import type { Column, Label, Task } from "@/lib/db/schema";
import { toast } from "@/lib/toast";
import BoardColumn, { TaskCardView } from "./column";
import BoardFilterBar from "./board-filter-bar";
import { filterGrouping } from "./board-filter-model";
import { useBoardLabelFilter } from "./use-board-label-filter";
import { boardCollisionDetection } from "./collision";
import { type DropTarget, type Pointer, locateFromPointer } from "./locate";
import { computeMove } from "./move";

function groupTasks(tasks: Task[]): Map<string, Task[]> {
  const grouping = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = grouping.get(task.columnId) ?? [];
    list.push(task);
    grouping.set(task.columnId, list);
  }
  for (const list of grouping.values()) {
    list.sort((a, b) => a.position - b.position);
  }
  return grouping;
}

function groupingKey(grouping: Map<string, Task[]>): string {
  return [...grouping.entries()]
    .map(
      ([columnId, list]) =>
        `${columnId}:${list.map((task) => task.id).join(",")}`,
    )
    .join("|");
}

function pointerFromActivator(event: DragStartEvent): Pointer | null {
  const activator = event.activatorEvent;
  if (!activator || typeof activator !== "object") return null;
  if ("clientX" in activator && "clientY" in activator) {
    return {
      x: activator.clientX as number,
      y: activator.clientY as number,
    };
  }
  const touch = (
    activator as { touches?: { clientX: number; clientY: number }[] }
  ).touches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.8",
      },
    },
  }),
  duration: 300,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
};

export default function KanbanBoard({
  projectId,
  columns,
  tasks,
  labelsByTask,
  onOpenTask,
  disableDragDrop = false,
}: {
  projectId: string;
  columns: Column[];
  tasks: Task[];
  labelsByTask: Map<string, Label[]>;
  onOpenTask: (taskId: string) => void;
  disableDragDrop?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Map<string, Task[]> | null>(null);
  const [writing, setWriting] = useState(false);
  const [addingColumnId, setAddingColumnId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const addButtonRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const prevAddingRef = useRef<string | null>(null);
  const justDraggedRef = useRef(false);
  const laneEls = useRef(new Map<string, HTMLElement | null>());
  const pointerRef = useRef<Pointer | null>(null);
  const lastPointerRef = useRef<Pointer | null>(null);
  const lastTargetKeyRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: disableDragDrop ? 999999 : 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: disableDragDrop ? 999999 : 250,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Return focus to the column's Add button when its quick-add form closes.
  useEffect(() => {
    if (prevAddingRef.current !== null && addingColumnId === null) {
      addButtonRefs.current.get(prevAddingRef.current)?.focus();
    }
    prevAddingRef.current = addingColumnId;
  }, [addingColumnId]);

  // Track the live pointer while dragging. Placement derives from these
  // coordinates (not dnd-kit's `over` identity), so a steady pointer
  // always resolves the same target and preview updates converge.
  useEffect(() => {
    if (!activeId) return undefined;
    const update = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", update);
    return () => window.removeEventListener("pointermove", update);
  }, [activeId]);

  const liveGrouping = useMemo(() => groupTasks(tasks), [tasks]);

  // Labels filter: render-only. Drag math, drop writes, and the echo
  // handoff all stay on the full order so hidden tasks keep their places.
  // A held preview carries the full order too and is intersected here, so
  // filtered-out tasks never flash mid-drag.
  const { selected, toggle, clear } = useBoardLabelFilter(projectId);
  const shownGrouping = useMemo(
    () =>
      filterGrouping(preview ?? liveGrouping, labelsByTask, selected),
    [preview, liveGrouping, labelsByTask, selected],
  );

  // Release a held drop preview once live data echoes the same order,
  // so the handoff is seamless
  useEffect(() => {
    if (
      preview &&
      !writing &&
      groupingKey(liveGrouping) === groupingKey(preview)
    ) {
      setPreview(null);
    }
  }, [preview, writing, liveGrouping]);

  function registerLaneRef(columnId: string, element: HTMLElement | null) {
    if (element) laneEls.current.set(columnId, element);
    else laneEls.current.delete(columnId);
  }

  function resolveTarget(
    event: DragOverEvent | DragEndEvent,
    movingId: string,
  ): DropTarget | null {
    const pointer = pointerRef.current;
    if (pointer) {
      return locateFromPointer(laneEls.current, columns, movingId, pointer);
    }
    // Keyboard drags carry no pointer: fall back to dnd-kit's target with
    // the default before/after rule.
    const overId = event.over ? String(event.over.id) : null;
    return overId ? { overId, placeAfter: "auto" as const } : null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    pointerRef.current = pointerFromActivator(event);
  }

  function handleDragOver(event: DragOverEvent) {
    if (disableDragDrop || !activeId) {
      setPreview(null);
      return;
    }
    // A held drop preview owns the view until the live echo lands.
    if (writing) return;
    const target = resolveTarget(event, activeId);
    // Skip redundant work: same pointer + same target cannot move anything.
    const pointer = pointerRef.current;
    const targetKey = target
      ? `${target.overId}:${String(target.placeAfter)}`
      : "null";
    const samePointer =
      pointer !== null &&
      lastPointerRef.current !== null &&
      pointer.x === lastPointerRef.current.x &&
      pointer.y === lastPointerRef.current.y;
    if (samePointer && targetKey === lastTargetKeyRef.current) return;
    lastPointerRef.current = pointer ? { x: pointer.x, y: pointer.y } : null;
    lastTargetKeyRef.current = targetKey;
    if (!target) {
      setPreview(null);
      return;
    }
    const computed = computeMove(
      liveGrouping,
      columns,
      activeId,
      target.overId,
      target.placeAfter,
    );
    if (!computed) {
      setPreview(null);
      return;
    }
    setPreview((previous) => {
      if (
        previous &&
        groupingKey(previous) === groupingKey(computed.grouping)
      ) {
        return previous;
      }
      return computed.grouping;
    });
  }

  function resetDrag() {
    setActiveId(null);
    setPreview(null);
    pointerRef.current = null;
    lastPointerRef.current = null;
    lastTargetKeyRef.current = null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active } = event;
    justDraggedRef.current = true;
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
    const movingId = String(active.id);
    if (disableDragDrop || writing) {
      resetDrag();
      return;
    }
    const target = resolveTarget(event, movingId);
    if (!target || target.overId === movingId) {
      resetDrag();
      return;
    }
    const computed = computeMove(
      groupTasks(tasks),
      columns,
      movingId,
      target.overId,
      target.placeAfter,
    );
    if (!computed || computed.dirty.length === 0) {
      resetDrag();
      return;
    }
    // Hold the dropped order through the live echo:
    // the overlay settles into the new slot instead of flying home.
    setActiveId(null);
    setPreview(computed.grouping);
    setWriting(true);
    try {
      await reorderTasks(projectId, computed.dirty);
    } catch (error) {
      setPreview(null);
      toast.error(
        error instanceof Error ? error.message : "Failed to move task",
      );
    } finally {
      setWriting(false);
    }
  }

  const canSave =
    draft.trim().length >= QUICK_ADD_TITLE_MIN &&
    draft.trim().length <= QUICK_ADD_TITLE_MAX &&
    !saving;

  function openAdd(columnId: string) {
    setAddingColumnId(columnId);
    setDraft("");
  }

  function cancelAdd() {
    setAddingColumnId(null);
    setDraft("");
  }

  async function saveTask(columnId: string) {
    const title = draft.trim();
    if (
      title.length < QUICK_ADD_TITLE_MIN ||
      title.length > QUICK_ADD_TITLE_MAX ||
      saving
    )
      return;
    setSaving(true);
    try {
      await createTask({ projectId, columnId, title });
      setDraft("");
    } catch (error) {
      console.error("Failed to create task", error);
    } finally {
      setSaving(false);
    }
  }

  const activeTask = activeId
    ? (tasks.find((task) => task.id === activeId) ?? null)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={resetDrag}
    >
      <div className="flex h-full min-h-0 flex-col">
        <BoardFilterBar
          projectId={projectId}
          selected={selected}
          onToggle={toggle}
          onClear={clear}
        />
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4 pt-3">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={shownGrouping.get(column.id) ?? []}
              labelsByTask={labelsByTask}
              filterActive={selected !== null}
              disabled={disableDragDrop}
            justDraggedRef={justDraggedRef}
            onOpenTask={onOpenTask}
            adding={addingColumnId === column.id}
            draft={draft}
            canSave={canSave}
            saving={saving}
            addButtonRefs={addButtonRefs}
            onOpenAdd={openAdd}
            onCancelAdd={cancelAdd}
            onDraftChange={setDraft}
            onSaveTask={saveTask}
            registerLaneRef={registerLaneRef}
          />
        ))}
        </div>
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <div className="transform rotate-1 scale-[1.03] shadow-lg">
            <div className="rounded-lg ring-2 ring-ring/35">
              <TaskCardView
                task={activeTask}
                labels={labelsByTask.get(activeTask.id)}
                isFinal={
                  columns.find((column) => column.id === activeTask.columnId)
                    ?.isFinal ?? false
                }
              />
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
