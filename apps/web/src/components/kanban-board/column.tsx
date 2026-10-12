import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Calendar, CalendarClock, CalendarX, Plus } from "lucide-react";
import type { Column, Label, Task } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { getColumnIcon } from "@/lib/column";
import {
  getDueDateStatus,
  parseLocalDate,
} from "@/lib/due-date-status";
import { getPriorityIcon, priorityLabel } from "@/lib/priority";
import { cn } from "@/lib/utils";
import { TaskLabels } from "@/components/task/task-labels";

const dueDateTextColors = {
  overdue: "text-destructive-foreground",
  "due-soon": "text-warning-foreground",
  "far-future": "text-muted-foreground",
  "no-due-date": "text-muted-foreground",
} as const;

/**
 * Kaneo card chrome: clamp-3 medium title, labels, then the priority / due
 * meta row. Finished columns step back (dimmed, meta hidden — Kaneo treats
 * finished work as settled). Assignees, numbers, context menus, and
 * integration badges stay out: unimplemented features.
 */
export function TaskCardView({
  task,
  labels,
  isFinal = false,
  dimmed,
}: {
  task: Task;
  labels?: Label[];
  isFinal?: boolean;
  dimmed?: boolean;
}) {
  const dueDateStatus = getDueDateStatus(task.dueDate, isFinal);
  const isOverdue = dueDateStatus === "overdue";

  return (
    <article
      className={cn(
        "group relative rounded-lg border p-3 transition-[background-color,border-color,box-shadow] duration-150 ease-out",
        // Finished work steps back so open cards draw the eye.
        isFinal ? "bg-background/60" : "bg-card shadow-sm/5",
        dimmed && "border-ring/40 bg-card shadow-lg",
        !dimmed &&
          (isOverdue
            ? "border-destructive/70 ring-[3px] ring-destructive/10"
            : "border-border/80 hover:bg-background hover:shadow-sm"),
      )}
    >
      <div className={cn(!isFinal && "mb-2.5")}>
        <div
          className={cn(
            "overflow-hidden wrap-break-word font-medium text-[15px] leading-5",
            isFinal ? "text-muted-foreground" : "text-foreground/95",
          )}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
            hyphens: "auto",
          }}
        >
          {task.title}
        </div>
      </div>

      {!isFinal && labels && labels.length > 0 && (
        <div className="mb-2.5">
          <TaskLabels labels={labels} />
        </div>
      )}

      {!isFinal && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <Badge
            variant={task.priority === "urgent" ? "destructive" : "outline"}
            title={priorityLabel(task.priority)}
            className="gap-1 font-medium rounded-md! text-sm h-6!"
          >
            {getPriorityIcon(task.priority)}
            <span>{priorityLabel(task.priority)}</span>
          </Badge>
          {task.dueDate && (
            <div
              className={cn(
                "flex h-5 items-center gap-1 text-[10px]",
                isOverdue && "font-medium",
                dueDateTextColors[dueDateStatus],
              )}
            >
              {dueDateStatus === "overdue" && (
                <CalendarX className="h-3 w-3" aria-hidden="true" />
              )}
              {dueDateStatus === "due-soon" && (
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
              )}
              {(dueDateStatus === "far-future" ||
                dueDateStatus === "no-due-date") && (
                <Calendar className="h-3 w-3" aria-hidden="true" />
              )}
              <span>{format(parseLocalDate(task.dueDate), "MMM d")}</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SortableTaskCard({
  task,
  labels,
  isFinal,
  disabled,
  justDraggedRef,
  onOpen,
}: {
  task: Task;
  labels?: Label[];
  isFinal: boolean;
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
      <TaskCardView task={task} labels={labels} isFinal={isFinal} dimmed={isDragging} />
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
  onCreateTask,
  registerLaneRef,
}: {
  column: Column;
  tasks: Task[];
  labelsByTask: Map<string, Label[]>;
  filterActive: boolean;
  disabled: boolean;
  justDraggedRef: React.RefObject<boolean>;
  onOpenTask: (taskId: string) => void;
  onCreateTask: (columnId: string) => void;
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
      className={`flex h-full min-h-0 w-full flex-col gap-2 rounded-xl bg-muted/50 p-2 ${isOver ? "ring-2 ring-ring/40" : ""}`}
    >
      <header className="flex items-center justify-between gap-2 px-1.5 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-muted-foreground">
            {getColumnIcon(column.slug, column.isFinal)}
          </span>
          <h2 className="truncate text-sm font-medium text-foreground/95">
            {column.name}
          </h2>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onCreateTask(column.id)}
          title={`Add task to ${column.name}`}
          aria-label={`Add task to ${column.name}`}
          className="flex shrink-0 items-center rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent/50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div className="flex flex-col gap-2 overflow-auto">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              labels={labelsByTask.get(task.id)}
              isFinal={column.isFinal}
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
    </section>
  );
}
