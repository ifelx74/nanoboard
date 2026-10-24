import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Plus, SquareCheck } from "lucide-react";
import { useState } from "react";
import { ProjectLayout } from "@/components/common/project-layout";
import CreateTaskDialog from "@/components/task/create-task-dialog";
import TaskDrawer from "@/components/task/task-drawer";
import TaskDueDatePopover from "@/components/task/task-due-date-popover";
import TaskLabelsPopover from "@/components/task/task-labels-popover";
import TaskPriorityPopover from "@/components/task/task-priority-popover";
import { getColumnIcon } from "@/lib/column";
import {
  formatRelativeDueDate,
  getDueDateStatus,
  parseLocalDate,
} from "@/lib/due-date-status";
import {
  getProject,
  getProjectColumns,
  getProjectTaskLabels,
  getProjectTasks,
} from "@/lib/db/queries";
import type { Column, Label, Task } from "@/lib/db/schema";
import { resolveLabelColor } from "@/lib/label-color";
import { getPriorityIcon, priorityLabel } from "@/lib/priority";
import { getChecklistStats } from "@/lib/task-checklist";
import { taskKey } from "@/lib/task-key";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/project/$projectId/list")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { task?: string } => ({
    task: typeof search.task === "string" ? search.task : undefined,
  }),
});

function formatMedium(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ListSkeleton() {
  return (
    <div className="h-full overflow-auto bg-muted/20" aria-hidden="true">
      {["skeleton-section-0", "skeleton-section-1"].map((key) => (
        <div key={key} className="border-b border-border/50">
          <div className="flex items-center gap-2 border-b border-border/50 bg-muted/60 px-4 py-2">
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
          {["a", "b", "c"].map((row) => (
            <div
              key={row}
              className="flex h-10 items-center gap-3 border-b border-border/50 px-3.5 last:border-0"
            >
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TaskRow({
  task,
  projectSlug,
  labels,
  isFinal,
  onOpen,
}: {
  task: Task;
  projectSlug: string;
  labels: Label[];
  isFinal: boolean;
  onOpen: (taskId: string) => void;
}) {
  const stats = getChecklistStats(task.description);
  const dueStatus =
    task.dueDate === undefined ? null : getDueDateStatus(task.dueDate, isFinal);

  return (
    <div
      onClick={() => onOpen(task.id)}
      className="group flex h-10 cursor-pointer items-center gap-3 border-b border-border/50 px-3.5 outline-none transition-colors last:border-0 hover:bg-accent/60"
    >
      <TaskPriorityPopover task={task}>
        <button
          type="button"
          aria-label={`Priority: ${priorityLabel(task.priority)}`}
          title={`Priority: ${priorityLabel(task.priority)}`}
          onClick={(event) => event.stopPropagation()}
          className="flex size-5.5 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5"
        >
          {getPriorityIcon(task.priority)}
        </button>
      </TaskPriorityPopover>

      <span className="w-15 shrink-0 truncate font-mono text-xs text-muted-foreground">
        {taskKey(projectSlug, task.number)}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm text-foreground">{task.title}</span>
        {stats && (
          <span className="inline-flex h-5 shrink-0 cursor-default items-center gap-1 rounded-md px-1 text-xs tabular-nums text-muted-foreground">
            <SquareCheck className="size-3" aria-hidden="true" />
            {stats.done}/{stats.total}
          </span>
        )}
      </div>

      {labels.length > 0 && (
        <TaskLabelsPopover task={task}>
          <span
            onClick={(event) => event.stopPropagation()}
            className="flex min-w-0 cursor-pointer items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {labels.slice(0, 2).map((label) => (
              <span
                key={label.id}
                className="flex max-w-36 items-center gap-1.5 rounded-md border border-border px-1.5 py-0.5 text-xs text-foreground"
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: resolveLabelColor(label.color) }}
                />
                <span className="truncate">{label.name}</span>
              </span>
            ))}
            {labels.length > 2 && (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                +{labels.length - 2}
              </span>
            )}
          </span>
        </TaskLabelsPopover>
      )}

      {task.dueDate !== undefined && (
        <TaskDueDatePopover task={task}>
          <button
            type="button"
            title={formatMedium(parseLocalDate(task.dueDate))}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "flex w-24 shrink-0 cursor-pointer items-center justify-end rounded-md text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              dueStatus === "overdue"
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {formatRelativeDueDate(parseLocalDate(task.dueDate))}
          </button>
        </TaskDueDatePopover>
      )}
    </div>
  );
}

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { task: selectedTaskId } = Route.useSearch();
  const navigate = useNavigate();
  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const columns = useLiveQuery(() => getProjectColumns(projectId), [projectId]);
  const tasks = useLiveQuery(() => getProjectTasks(projectId), [projectId]);
  const labelsByTask = useLiveQuery(
    () => getProjectTaskLabels(projectId),
    [projectId],
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [createColumn, setCreateColumn] = useState<Column | null>(null);

  function openTask(taskId: string) {
    void navigate({
      to: "/project/$projectId/list",
      params: { projectId },
      search: { task: taskId },
    });
  }

  function closeTask() {
    void navigate({
      to: "/project/$projectId/list",
      params: { projectId },
      search: {},
    });
  }

  if (
    tasks === undefined ||
    project === undefined ||
    columns === undefined ||
    labelsByTask === undefined
  ) {
    return (
      <ProjectLayout projectId={projectId} activeView="list">
        <ListSkeleton />
        <TaskDrawer
          projectId={projectId}
          taskId={selectedTaskId}
          onClose={closeTask}
          onSelectTask={openTask}
        />
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout projectId={projectId} activeView="list">
      <div className="h-full overflow-auto bg-muted/20">
        <div className="divide-y divide-border/50">
          {columns.map((column) => {
            const columnTasks = tasks
              .filter((task) => task.columnId === column.id)
              .sort((a, b) => a.position - b.position);
            const isExpanded = expanded[column.id] ?? true;
            return (
              <section key={column.id} className="border-b border-border/50">
                <div className="flex items-center justify-between border-b border-border/50 bg-muted/60 px-4 py-2">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [column.id]: !(current[column.id] ?? true),
                      }))
                    }
                    className="flex items-center gap-2 text-sm font-medium text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className={cn(
                        "h-3 w-3 transition-transform duration-150 ease-out",
                        isExpanded && "rotate-90",
                      )}
                    />
                    <span className="flex h-4 items-center gap-2">
                      {getColumnIcon(column.slug, column.isFinal)}
                      <span>{column.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {columnTasks.length}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    title={`Add task to ${column.name}`}
                    aria-label={`Add task to ${column.name}`}
                    onClick={() => setCreateColumn(column)}
                    className="rounded p-1 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
                {isExpanded &&
                  (columnTasks.length > 0 ? (
                    <div className="bg-card">
                      {columnTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          projectSlug={project.slug}
                          labels={labelsByTask.get(task.id) ?? []}
                          isFinal={column.isFinal}
                          onOpen={openTask}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No tasks
                    </div>
                  ))}
              </section>
            );
          })}
        </div>
      </div>
      {createColumn && (
        <CreateTaskDialog
          key={createColumn.id}
          projectId={projectId}
          column={createColumn}
          open
          onClose={() => setCreateColumn(null)}
        />
      )}
      <TaskDrawer
        projectId={projectId}
        taskId={selectedTaskId}
        onClose={closeTask}
        onSelectTask={openTask}
      />
    </ProjectLayout>
  );
}
