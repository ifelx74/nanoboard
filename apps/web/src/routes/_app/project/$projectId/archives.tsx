import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useState } from "react";
import { ProjectLayout } from "@/components/common/project-layout";
import ArchiveCompletedTasksDialog from "@/components/task/archive-completed-tasks-dialog";
import TaskDeleteDialog from "@/components/task/task-delete-dialog";
import TaskDrawer from "@/components/task/task-drawer";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  countArchivableTasks,
  getArchivedProjectTasks,
  getProject,
  restoreTask,
} from "@/lib/db/queries";
import { db } from "@/lib/db/db";
import type { Task } from "@/lib/db/schema";
import { toast } from "@/lib/toast";
import { taskKey } from "@/lib/task-key";

export const Route = createFileRoute("/_app/project/$projectId/archives")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { task?: string } => ({
    task: typeof search.task === "string" ? search.task : undefined,
  }),
});

function formatArchivedDate(archivedAt: number): string {
  return new Date(archivedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ArchivesSkeleton() {
  return (
    <div className="h-full overflow-auto bg-muted/20" aria-hidden="true">
      {["skeleton-row-0", "skeleton-row-1", "skeleton-row-2"].map((key) => (
        <div
          key={key}
          className="flex h-11 items-center gap-3 border-b border-border/50 px-4 last:border-0"
        >
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-4 w-28 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ArchiveRow({
  task,
  projectSlug,
  onOpen,
  onRestore,
  onDelete,
}: {
  task: Task;
  projectSlug: string;
  onOpen: (taskId: string) => void;
  onRestore: (taskId: string) => void;
  onDelete: (task: Task) => void;
}) {
  const archivedAt = task.archivedAt ?? 0;
  return (
    <div
      onClick={() => onOpen(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task.id);
        }
      }}
      role="button"
      tabIndex={0}
      className="group flex h-11 cursor-pointer items-center gap-3 border-b border-border/50 px-4 outline-none transition-colors last:border-0 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <span className="w-15 shrink-0 truncate font-mono text-xs text-muted-foreground">
        {taskKey(projectSlug, task.number)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {task.title}
      </span>
      <span
        title={`Archived on ${formatArchivedDate(archivedAt)}`}
        className="hidden w-32 shrink-0 text-right text-xs text-muted-foreground sm:block"
      >
        {formatArchivedDate(archivedAt)}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label="Restore task"
          title="Restore task"
          onClick={(event) => {
            event.stopPropagation();
            onRestore(task.id);
          }}
          className="rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArchiveRestore className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Delete task"
          title="Delete task"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(task);
          }}
          className="rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { task: selectedTaskId } = Route.useSearch();
  const navigate = useNavigate();
  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const archivedTasks = useLiveQuery(
    () => getArchivedProjectTasks(db, projectId),
    [projectId],
  );
  const eligibleCount = useLiveQuery(
    () => countArchivableTasks(db, projectId),
    [projectId],
  );
  const [sweepOpen, setSweepOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  function openTask(taskId: string) {
    void navigate({
      to: "/project/$projectId/archives",
      params: { projectId },
      search: { task: taskId },
    });
  }

  function closeTask() {
    void navigate({
      to: "/project/$projectId/archives",
      params: { projectId },
      search: {},
    });
  }

  async function handleRestore(taskId: string) {
    try {
      await restoreTask(db, taskId);
      toast.success("Task restored");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to restore task",
      );
    }
  }

  function handleSweepClick() {
    if (eligibleCount === undefined) return;
    if (eligibleCount === 0) {
      toast.info("No completed tasks to archive");
      return;
    }
    setSweepOpen(true);
  }

  const sweepButton = (
    <Button
      variant="outline"
      size="sm"
      aria-label="Archive completed tasks"
      title="Archive completed tasks"
      onClick={handleSweepClick}
    >
      <Archive />
      <span className="hidden sm:inline">Archive completed tasks</span>
    </Button>
  );

  if (archivedTasks === undefined || project === undefined) {
    return (
      <ProjectLayout
        projectId={projectId}
        activeView="archives"
        headerAction={sweepButton}
      >
        <ArchivesSkeleton />
        <TaskDrawer
          projectId={projectId}
          taskId={selectedTaskId}
          onClose={closeTask}
          onSelectTask={openTask}
        />
      </ProjectLayout>
    );
  }

  const archiveCount = archivedTasks.length;

  return (
    <ProjectLayout
      projectId={projectId}
      activeView="archives"
      headerAction={sweepButton}
      archiveCount={archiveCount}
    >
      {archiveCount === 0 ? (
        <div className="flex h-full items-center justify-center bg-muted/20 p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12">
                <Archive className="size-6" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No archived tasks yet</EmptyTitle>
              <EmptyDescription>
                Tasks you archive — completed or cancelled — will show up here.
              </EmptyDescription>
            </EmptyHeader>
            {(eligibleCount ?? 0) > 0 && (
              <EmptyContent>
                <Button size="sm" onClick={() => setSweepOpen(true)}>
                  <Archive />
                  Archive completed tasks
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </div>
      ) : (
        <div className="h-full overflow-auto bg-muted/20">
          <div className="divide-y divide-border/50">
            {archivedTasks.map((task) => (
              <ArchiveRow
                key={task.id}
                task={task}
                projectSlug={project.slug}
                onOpen={openTask}
                onRestore={(id) => void handleRestore(id)}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </div>
      )}
      <ArchiveCompletedTasksDialog
        open={sweepOpen}
        onOpenChange={setSweepOpen}
        projectId={projectId}
        eligibleCount={eligibleCount ?? 0}
      />
      {deleteTarget && (
        <TaskDeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          taskId={deleteTarget.id}
          taskTitle={deleteTarget.title}
          onDeleted={() => setDeleteTarget(null)}
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
