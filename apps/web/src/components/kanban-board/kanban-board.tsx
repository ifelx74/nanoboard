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
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  QUICK_ADD_TITLE_MAX,
  QUICK_ADD_TITLE_MIN,
  createTask,
  reorderTasks,
} from "@/lib/db/queries";
import type { Column, Task } from "@/lib/db/schema";
import { toast } from "@/lib/toast";
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
    .map(([columnId, list]) => `${columnId}:${list.map((task) => task.id).join(",")}`)
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

function TaskCard({
  task,
  dimmed,
  onOpen,
}: {
  task: Task;
  dimmed?: boolean;
  onOpen?: (taskId: string) => void;
}) {
  return (
    <article
      onClick={() => onOpen?.(task.id)}
      className={`rounded-lg border border-border/80 bg-card p-2.5 shadow-sm/5 ${dimmed ? "opacity-40" : ""}`}
    >
      <p className="text-sm">{task.title}</p>
      {task.dueDate && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Due {task.dueDate}
        </p>
      )}
    </article>
  );
}

function SortableTaskCard({
  task,
  disabled,
  justDraggedRef,
  onOpen,
}: {
  task: Task;
  disabled: boolean;
  justDraggedRef: React.RefObject<boolean>;
  onOpen: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled });

  return (
    <div
      ref={setNodeRef}
      data-task-id={task.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!justDraggedRef.current) onOpen(task.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !isDragging) onOpen(task.id);
      }}
      tabIndex={0}
      className="cursor-pointer touch-none outline-none"
    >
      <TaskCard task={task} dimmed={isDragging} />
    </div>
  );
}

function BoardColumn({
  column,
  tasks,
  disabled,
  justDraggedRef,
  onOpenTask,
  adding,
  draft,
  canSave,
  saving,
  addButtonRefs,
  onOpenAdd,
  onCancelAdd,
  onDraftChange,
  onSaveTask,
  registerLaneRef,
}: {
  column: Column;
  tasks: Task[];
  disabled: boolean;
  justDraggedRef: React.RefObject<boolean>;
  onOpenTask: (taskId: string) => void;
  adding: boolean;
  draft: string;
  canSave: boolean;
  saving: boolean;
  addButtonRefs: React.RefObject<Map<string, HTMLButtonElement | null>>;
  onOpenAdd: (columnId: string) => void;
  onCancelAdd: () => void;
  onDraftChange: (value: string) => void;
  onSaveTask: (columnId: string) => void;
  registerLaneRef: (columnId: string, element: HTMLElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", taskIds: tasks.map((task) => task.id) },
    disabled,
  });

  return (
    <section
      ref={(element) => {
        setNodeRef(element);
        registerLaneRef(column.id, element);
      }}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2 ${isOver ? "ring-2 ring-ring/40" : ""}`}
    >
      <header className="flex items-center justify-between px-1.5 py-1">
        <h2 className="text-sm font-medium">{column.name}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </header>
      <div className="flex flex-col gap-2">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              disabled={disabled}
              justDraggedRef={justDraggedRef}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="px-1.5 py-1 text-xs text-muted-foreground">No tasks</p>
        )}
      </div>
      {adding ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSaveTask(column.id);
          }}
          className="flex flex-col gap-1.5"
        >
          <input
            autoFocus
            value={draft}
            maxLength={QUICK_ADD_TITLE_MAX}
            placeholder="Task title"
            aria-label={`New task title in ${column.name}`}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancelAdd();
            }}
            onBlur={() => {
              if (!saving) onCancelAdd();
            }}
            className="h-8 rounded-lg border border-border/80 bg-card px-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={!canSave}
              onMouseDown={(event) => event.preventDefault()}
              className="h-7 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={onCancelAdd}
              onMouseDown={(event) => event.preventDefault()}
              className="h-7 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={(element) => {
            addButtonRefs.current?.set(column.id, element);
          }}
          type="button"
          onClick={() => onOpenAdd(column.id)}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add task
        </button>
      )}
    </section>
  );
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

/**
 * Interactive kanban board (mirrors Kaneo's KanbanBoard, minus
 * bulk-selection, background, sorting, and server cache layers).
 * Hover preview is ephemeral local state; the drop writes one dense
 * reorder transaction and live queries re-render.
 */
export default function KanbanBoard({
  projectId,
  columns,
  tasks,
  onOpenTask,
  disableDragDrop = false,
}: {
  projectId: string;
  columns: Column[];
  tasks: Task[];
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

  const liveGrouping = groupTasks(tasks);
  const shownGrouping = preview ?? liveGrouping;

  // Release a held drop preview once live data echoes the same order,
  // so the handoff is seamless (mirrors Kaneo's optimistic set +
  // invalidate echo: rendered order never snaps back post-drop).
  useEffect(() => {
    if (preview && !writing && groupingKey(liveGrouping) === groupingKey(preview)) {
      setPreview(null);
    }
  });

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
    return overId ? { overId } : null;
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
    if (!target) {
      setPreview(null);
      return;
    }
    const computed = computeMove(
      liveGrouping,
      columns,
      activeId,
      target.overId,
      target.insertAfter,
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
      target.insertAfter,
    );
    if (!computed || computed.dirty.length === 0) {
      resetDrag();
      return;
    }
    // Hold the dropped order through the live echo (Kaneo's optimistic
    // set): the overlay settles into the new slot instead of flying home.
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
    ? tasks.find((task) => task.id === activeId) ?? null
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
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            tasks={shownGrouping.get(column.id) ?? []}
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
      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <div className="transform rotate-1 scale-[1.03] shadow-lg">
            <div className="rounded-lg ring-2 ring-ring/35">
              <div className="rounded-lg border border-border/80 bg-card p-2.5 shadow-sm/5">
                <p className="text-sm">{activeTask.title}</p>
                {activeTask.dueDate && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Due {activeTask.dueDate}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
