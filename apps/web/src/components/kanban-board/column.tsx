import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { QUICK_ADD_TITLE_MAX } from "@/lib/db/queries";
import type { Column, Label, Task } from "@/lib/db/schema";
import { TaskLabels } from "@/components/task/task-labels";

export function TaskCardView({
  task,
  labels,
  dimmed,
}: {
  task: Task;
  labels?: Label[];
  dimmed?: boolean;
}) {
  return (
    <article
      className={`rounded-lg border border-border/80 bg-card p-2.5 shadow-sm/5 ${dimmed ? "opacity-40" : ""}`}
    >
      <p className="text-sm">{task.title}</p>
      {labels && labels.length > 0 && (
        <div className="mt-1.5">
          <TaskLabels labels={labels} />
        </div>
      )}
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
  labels,
  disabled,
  justDraggedRef,
  onOpen,
}: {
  task: Task;
  labels?: Label[];
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
      <TaskCardView task={task} labels={labels} dimmed={isDragging} />
    </div>
  );
}

export default function BoardColumn({
  column,
  tasks,
  labelsByTask,
  filterActive,
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
  labelsByTask: Map<string, Label[]>;
  filterActive: boolean;
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
              labels={labelsByTask.get(task.id)}
              disabled={disabled}
              justDraggedRef={justDraggedRef}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="px-1.5 py-1 text-xs text-muted-foreground">
            {filterActive ? "No matching tasks" : "No tasks"}
          </p>
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
