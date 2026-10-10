import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ProjectLayout } from "@/components/common/project-layout";
import { getProjectTasks } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/project/$projectId/list")({
  component: RouteComponent,
});

const priorityStyles: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-secondary text-secondary-foreground",
  high: "bg-destructive/10 text-destructive",
  urgent: "bg-destructive text-destructive-foreground",
};

const skeletonRowKeys = ["skeleton-row-0", "skeleton-row-1", "skeleton-row-2", "skeleton-row-3"];

function ListSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-4" aria-hidden="true">
      <div className="overflow-hidden rounded-xl border border-border/80">
        <div className="flex flex-col">
          {skeletonRowKeys.map((key) => (
            <div
              key={key}
              className="flex items-center gap-3 border-b border-border/50 px-3 py-2.5 last:border-0"
            >
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RouteComponent() {
  const { projectId } = Route.useParams();
  const tasks = useLiveQuery(() => getProjectTasks(projectId), [projectId]);

  if (tasks === undefined) {
    return (
      <ProjectLayout projectId={projectId} activeView="list">
        <ListSkeleton />
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout projectId={projectId} activeView="list">
      <div className="h-full overflow-y-auto p-4">
        <div className="overflow-hidden rounded-xl border border-border/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    No tasks in this project
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2">{task.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {task.dueDate ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {task.priority !== "no-priority" ? (
                      <span
                        className={cn(
                          "inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium capitalize",
                          priorityStyles[task.priority],
                        )}
                      >
                        {task.priority}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ProjectLayout>
  );
}
