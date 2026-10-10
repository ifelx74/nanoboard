import { useLiveQuery } from "dexie-react-hooks";
import { Copy, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetPanel, SheetPopup } from "@/components/ui/sheet";
import {
  duplicateTask,
  getProject,
  getProjectColumns,
  getTask,
} from "@/lib/db/queries";
import { toast } from "@/lib/toast";
import TaskColumnPopover from "./task-column-popover";
import TaskDeleteDialog from "./task-delete-dialog";
import TaskDescription from "./task-description";
import TaskDueDatePopover from "./task-due-date-popover";
import TaskPriorityPopover from "./task-priority-popover";
import TaskTitle from "./task-title";

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function TaskDrawer({
  projectId,
  taskId,
  onClose,
  onSelectTask,
}: {
  projectId: string;
  taskId: string | undefined;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
}) {
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(
    taskId,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (taskId) {
      setCurrentTaskId(taskId);
      return undefined;
    }
    const timer = setTimeout(() => {
      setCurrentTaskId(undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [taskId]);

  const task = useLiveQuery(
    () => (currentTaskId ? getTask(currentTaskId) : undefined),
    [currentTaskId],
  );
  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const columns = useLiveQuery(() => getProjectColumns(projectId), [projectId]);

  async function handleDuplicate() {
    if (!task || duplicating) return;
    setDuplicating(true);
    try {
      const id = await duplicateTask(task.id);
      toast.success("Task duplicated");
      onSelectTask(id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to duplicate task",
      );
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <Sheet
      open={taskId !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetPopup
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-lg"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5">
          <span className="text-sm font-medium text-muted-foreground">
            {project && task
              ? `${project.slug}-${task.number}`
              : "Task"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Duplicate task"
              disabled={!task || duplicating}
              onClick={() => void handleDuplicate()}
              className="text-foreground"
            >
              <Copy className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete task"
              disabled={!task}
              onClick={() => setDeleteOpen(true)}
              className="text-foreground"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close"
              onClick={onClose}
              className="text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {currentTaskId && (
          <TaskDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            taskId={currentTaskId}
            taskTitle={task?.title ?? ""}
            onDeleted={onClose}
          />
        )}

        <SheetPanel>
          {!task || !columns ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <div key={task.id} className="flex flex-col gap-5">
              <TaskTitle task={task} />
              <div className="flex flex-col gap-2">
                <PropertyRow label="Status">
                  <TaskColumnPopover task={task} columns={columns}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 justify-start font-normal"
                    >
                      {columns.find((column) => column.id === task.columnId)
                        ?.name ?? task.status}
                    </Button>
                  </TaskColumnPopover>
                </PropertyRow>
                <PropertyRow label="Priority">
                  <TaskPriorityPopover task={task}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 justify-start font-normal capitalize"
                    >
                      {task.priority.replace("-", " ")}
                    </Button>
                  </TaskPriorityPopover>
                </PropertyRow>
                <PropertyRow label="Due date">
                  <TaskDueDatePopover task={task}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 justify-start font-normal"
                    >
                      {task.dueDate ?? "No due date"}
                    </Button>
                  </TaskDueDatePopover>
                </PropertyRow>
              </div>
              <TaskDescription task={task} />
            </div>
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
