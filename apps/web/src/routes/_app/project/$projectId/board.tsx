import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProjectLayout } from "@/components/common/project-layout";
import {
  QUICK_ADD_TITLE_MAX,
  QUICK_ADD_TITLE_MIN,
  createTask,
  getProjectColumns,
  getProjectTasks,
} from "@/lib/db/queries";
import type { Task } from "@/lib/db/schema";

export const Route = createFileRoute("/_app/project/$projectId/board")({
  component: RouteComponent,
});

const skeletonColumnKeys = ["skeleton-col-0", "skeleton-col-1", "skeleton-col-2", "skeleton-col-3"];
const skeletonCardKeys = ["skeleton-card-0", "skeleton-card-1", "skeleton-card-2"];

function BoardSkeleton() {
  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4" aria-hidden="true">
      {skeletonColumnKeys.map((columnKey) => (
        <section
          key={columnKey}
          className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2"
        >
          <header className="flex items-center justify-between px-1.5 py-1">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-5 animate-pulse rounded bg-muted" />
          </header>
          <div className="flex flex-col gap-2">
            {skeletonCardKeys.map((cardKey) => (
              <div
                key={cardKey}
                className="space-y-2 rounded-lg border border-border/80 bg-card p-2.5"
              >
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RouteComponent() {
  const { projectId } = Route.useParams();
  const columns = useLiveQuery(() => getProjectColumns(projectId), [projectId]);
  const tasks = useLiveQuery(() => getProjectTasks(projectId), [projectId]);
  const [addingColumnId, setAddingColumnId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const addButtonRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const prevAddingRef = useRef<string | null>(null);

  // Return focus to the column's Add button when its quick-add form closes.
  useEffect(() => {
    if (prevAddingRef.current !== null && addingColumnId === null) {
      addButtonRefs.current.get(prevAddingRef.current)?.focus();
    }
    prevAddingRef.current = addingColumnId;
  }, [addingColumnId]);

  if (columns === undefined || tasks === undefined) {
    return (
      <ProjectLayout projectId={projectId} activeView="board">
        <BoardSkeleton />
      </ProjectLayout>
    );
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

  const tasksByColumn = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = tasksByColumn.get(task.columnId) ?? [];
    list.push(task);
    tasksByColumn.set(task.columnId, list);
  }
  for (const list of tasksByColumn.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  return (
    <ProjectLayout projectId={projectId} activeView="board">
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {columns.map((column) => {
          const columnTasks = tasksByColumn.get(column.id) ?? [];
          return (
            <section
              key={column.id}
              className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2"
            >
              <header className="flex items-center justify-between px-1.5 py-1">
                <h2 className="text-sm font-medium">{column.name}</h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {columnTasks.length}
                </span>
              </header>
              <div className="flex flex-col gap-2">
                {columnTasks.map((task) => (
                  <article
                    key={task.id}
                    className="rounded-lg border border-border/80 bg-card p-2.5 shadow-sm/5"
                  >
                    <p className="text-sm">{task.title}</p>
                    {task.dueDate && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Due {task.dueDate}
                      </p>
                    )}
                  </article>
                ))}
                {columnTasks.length === 0 && (
                  <p className="px-1.5 py-1 text-xs text-muted-foreground">
                    No tasks
                  </p>
                )}
              </div>
              {addingColumnId === column.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveTask(column.id);
                  }}
                  className="flex flex-col gap-1.5"
                >
                  <input
                    autoFocus
                    value={draft}
                    maxLength={QUICK_ADD_TITLE_MAX}
                    placeholder="Task title"
                    aria-label={`New task title in ${column.name}`}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancelAdd();
                    }}
                    onBlur={() => {
                      if (!saving) cancelAdd();
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
                      onClick={cancelAdd}
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
                    addButtonRefs.current.set(column.id, element);
                  }}
                  type="button"
                  onClick={() => openAdd(column.id)}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add task
                </button>
              )}
            </section>
          );
        })}
      </div>
    </ProjectLayout>
  );
}
