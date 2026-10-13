import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ProjectLayout } from "@/components/common/project-layout";
import KanbanBoard from "@/components/kanban-board/kanban-board";
import TaskDrawer from "@/components/task/task-drawer";
import {
  getProject,
  getProjectColumns,
  getProjectTaskLabels,
  getProjectTasks,
} from "@/lib/db/queries";

export const Route = createFileRoute("/_app/project/$projectId/board")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { task?: string } => ({
    task: typeof search.task === "string" ? search.task : undefined,
  }),
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
  const { task: selectedTaskId } = Route.useSearch();
  const navigate = useNavigate();
  const columns = useLiveQuery(() => getProjectColumns(projectId), [projectId]);
  const tasks = useLiveQuery(() => getProjectTasks(projectId), [projectId]);
  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const labelsByTask = useLiveQuery(() => getProjectTaskLabels(projectId), [
    projectId,
  ]);

  function openTask(taskId: string) {
    void navigate({
      to: "/project/$projectId/board",
      params: { projectId },
      search: { task: taskId },
    });
  }

  function closeTask() {
    void navigate({
      to: "/project/$projectId/board",
      params: { projectId },
      search: {},
    });
  }

  if (columns === undefined || tasks === undefined || labelsByTask === undefined || project === undefined) {
    return (
      <ProjectLayout projectId={projectId} activeView="board">
        <BoardSkeleton />
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
    <ProjectLayout projectId={projectId} activeView="board">
      <KanbanBoard
        key={projectId}
        projectId={projectId}
        projectSlug={project.slug}
        columns={columns}
        tasks={tasks}
        labelsByTask={labelsByTask}
        onOpenTask={openTask}
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
