import { createFileRoute } from "@tanstack/react-router";
import { ProjectLayout } from "@/components/common/project-layout";
import { getProjectTasks, type MockTask } from "@/lib/mock";
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

function RouteComponent() {
  const { projectId } = Route.useParams();
  const tasks = getProjectTasks(projectId);

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
              {tasks.map((task: MockTask) => (
                <tr
                  key={task.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2">{task.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {task.dueDate ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {task.priority ? (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProjectLayout>
  );
}
