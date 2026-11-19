import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { ProjectLayout } from "@/components/common/project-layout";
import TimelineGantt, {
  type TimelineGanttTask,
} from "@/components/timeline/timeline-gantt";
import { buildTimeline } from "@/components/timeline/timeline-model";
import TaskDrawer from "@/components/task/task-drawer";
import { getProject, getProjectTasks } from "@/lib/db/queries";
import { projectRouteHead } from "@/lib/seo";
import { db } from "@/lib/db/db";
import { taskKey } from "@/lib/task-key";

export const Route = createFileRoute("/_app/project/$projectId/timeline")({
  component: RouteComponent,
  loader: ({ params }) => getProject(params.projectId).catch(() => undefined),
  head: projectRouteHead("timeline"),
  validateSearch: (search: Record<string, unknown>): { task?: string } => ({
    task: typeof search.task === "string" ? search.task : undefined,
  }),
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { task: selectedTaskId } = Route.useSearch();
  const navigate = useNavigate();
  const tasks = useLiveQuery(() => getProjectTasks(db, projectId), [projectId]);
  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const slug = project?.slug ?? "";

  const timelineTasks: TimelineGanttTask[] = useMemo(
    () =>
      (tasks ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        key: taskKey(slug, task.number),
        startDate: task.startDate,
        dueDate: task.dueDate,
        position: task.position,
      })),
    [tasks, slug],
  );

  const model = useMemo(() => buildTimeline(timelineTasks), [timelineTasks]);

  function openTask(taskId: string) {
    void navigate({
      to: "/project/$projectId/timeline",
      params: { projectId },
      search: { task: taskId },
    });
  }

  function closeTask() {
    void navigate({
      to: "/project/$projectId/timeline",
      params: { projectId },
      search: {},
    });
  }

  function goToBoard() {
    void navigate({
      to: "/project/$projectId/board",
      params: { projectId },
    });
  }

  if (tasks === undefined) {
    return (
      <ProjectLayout projectId={projectId} activeView="timeline">
        <div className="flex h-full min-h-0 flex-col" aria-hidden="true">
          <div className="border-b border-border/80 px-3 py-2 sm:px-4">
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            {Array.from({ length: 6 }, (_, i) => `skeleton-row-${i}`).map(
              (key) => (
                <div
                  key={key}
                  className="h-11 w-full shrink-0 animate-pulse rounded bg-muted/50"
                />
              ),
            )}
          </div>
        </div>
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
    <ProjectLayout projectId={projectId} activeView="timeline">
      <TimelineGantt
        model={model}
        projectId={projectId}
        onOpenTask={openTask}
        onEmptyAction={goToBoard}
      />
      <TaskDrawer
        projectId={projectId}
        taskId={selectedTaskId}
        onClose={closeTask}
        onSelectTask={openTask}
      />
    </ProjectLayout>
  );
}
