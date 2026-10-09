import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { ProjectLayout } from "@/components/common/project-layout";
import { getColumnTasks, getProjectColumns } from "@/lib/mock";

export const Route = createFileRoute("/_app/project/$projectId/board")({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const columns = getProjectColumns(projectId);

  return (
    <ProjectLayout projectId={projectId} activeView="board">
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {columns.map((column) => {
          const tasks = getColumnTasks(column.id);
          return (
            <section
              key={column.id}
              className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2"
            >
              <header className="flex items-center justify-between px-1.5 py-1">
                <h2 className="text-sm font-medium">{column.name}</h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {tasks.length}
                </span>
              </header>
              <div className="flex flex-col gap-2">
                {tasks.map((task) => (
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
              </div>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add task
              </button>
            </section>
          );
        })}
      </div>
    </ProjectLayout>
  );
}
