import { useLiveQuery } from "dexie-react-hooks";
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Copy,
  Link2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetPanel, SheetPopup } from "@/components/ui/sheet";
import {
  duplicateTask,
  getProject,
  getProjectColumns,
  getTask,
  getTaskLabels,
} from "@/lib/db/queries";
import { getColumnIcon } from "@/lib/column";
import { getDueDateStatus, parseLocalDate } from "@/lib/due-date-status";
import { formatDateShort } from "@/lib/due-date-status";
import { resolveLabelColor } from "@/lib/label-color";
import { getPriorityIcon, priorityLabel } from "@/lib/priority";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import TaskColumnPopover from "./task-column-popover";
import TaskDeleteDialog from "./task-delete-dialog";
import TaskDescription from "./task-description";
import TaskDueDatePopover from "./task-due-date-popover";
import TaskLabelsPopover from "./task-labels-popover";
import TaskPriorityPopover from "./task-priority-popover";
import TaskStartDatePopover from "./task-start-date-popover";
import TaskTitle from "./task-title";

const DUE_ICON_CLASS: Record<string, string> = {
  overdue: "text-destructive-foreground",
  "due-soon": "text-warning-foreground",
  "far-future": "text-muted-foreground",
  "no-due-date": "text-muted-foreground",
};

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

  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const task = useLiveQuery(
    () => (currentTaskId ? getTask(currentTaskId) : undefined),
    [currentTaskId],
  );
  const columns = useLiveQuery(() => getProjectColumns(projectId), [projectId]);
  const taskLabels = useLiveQuery(
    () => (currentTaskId ? getTaskLabels(currentTaskId) : undefined),
    [currentTaskId],
  );

  async function handleDuplicate() {
    if (!task || duplicating) return;
    setDuplicating(true);
    try {
      const id = await duplicateTask(task.id);
      onSelectTask(id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to duplicate task",
      );
    } finally {
      setDuplicating(false);
    }
  }

  function handleCopyLink() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          toast.message("Link copied to clipboard");
        })
        .catch(() => {
          toast.error("Failed to copy link");
        });
      return;
    }
    toast.error("Copy is not supported in this browser");
  }

  const taskColumn = columns?.find((column) => column.id === task?.columnId);
  const taskIsFinal = taskColumn?.isFinal ?? false;
  const dueStatus =
    task && columns ? getDueDateStatus(task.dueDate, taskIsFinal) : null;
  const DueIcon =
    dueStatus === "overdue"
      ? CalendarX
      : dueStatus === "due-soon"
        ? CalendarClock
        : Calendar;

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
        className="w-full p-0 sm:max-w-lg md:max-w-2xl lg:max-w-4xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5">
          <span className="text-sm font-medium text-muted-foreground">
            {project?.slug.toUpperCase() ?? ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Copy link to task" title="Copy link to task"
              onClick={handleCopyLink}
              className="text-foreground"
            >
              <Link2 className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Duplicate task" title="Duplicate task"
              disabled={!task || duplicating}
              onClick={() => void handleDuplicate()}
              className="text-foreground"
            >
              <Copy className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete task" title="Delete task"
              disabled={!task}
              onClick={() => setDeleteOpen(true)}
              className="text-foreground"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close" title="Close"
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

        <SheetPanel className="p-0">
          {!task || !columns || !taskLabels ? (
            <div className="flex flex-col gap-3 px-4 py-4" aria-hidden="true">
              <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <div key={task.id} className="flex min-h-0 flex-1 flex-col">
              <div className="flex w-full shrink-0 flex-col gap-0 border-b border-border bg-sidebar">
                <div className="flex w-full flex-row flex-wrap items-center gap-1 p-2 border-b">
                  <TaskColumnPopover task={task} columns={columns}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 justify-start gap-1.5 px-1.5"
                    >
                      {getColumnIcon(task.status, taskIsFinal)}
                      <span className="truncate text-xs font-semibold">
                        {taskColumn?.name ?? task.status}
                      </span>
                    </Button>
                  </TaskColumnPopover>
                  <TaskPriorityPopover task={task}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 justify-start gap-1.5 px-1.5"
                    >
                      {getPriorityIcon(task.priority)}
                      <span className="truncate text-xs font-semibold">
                        {priorityLabel(task.priority)}
                      </span>
                    </Button>
                  </TaskPriorityPopover>
                  <TaskStartDatePopover task={task}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 justify-start gap-1.5 px-1.5"
                    >
                      <CalendarDays
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span
                        className={cn(
                          "truncate text-xs font-semibold",
                          !task.startDate && "text-muted-foreground",
                        )}
                      >
                        {task.startDate
                          ? formatDateShort(parseLocalDate(task.startDate))
                          : "Start"}
                      </span>
                    </Button>
                  </TaskStartDatePopover>
                  <TaskDueDatePopover task={task}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 justify-start gap-1.5 px-1.5"
                    >
                      {task.dueDate && dueStatus ? (
                        <>
                          <DueIcon
                            className={cn(
                              "h-3.5 w-3.5",
                              DUE_ICON_CLASS[dueStatus],
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate text-xs font-semibold">
                            {formatDateShort(parseLocalDate(task.dueDate))}
                          </span>
                        </>
                      ) : (
                        <>
                          <Calendar
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="truncate text-xs font-semibold text-muted-foreground">
                            No date
                          </span>
                        </>
                      )}
                    </Button>
                  </TaskDueDatePopover>
                </div>

                <div className="flex flex-col gap-3 px-3 p-2">
                  <div className="flex flex-col gap-1">
                    <span className="px-2 text-xs font-medium text-foreground/70">
                      Labels
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 px-2">
                      <TaskLabelsPopover task={task}>
                        <span className="flex min-w-0 cursor-pointer flex-wrap items-center gap-1.5">
                          {taskLabels.map((label) => (
                            <span
                              key={label.id}
                              className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] transition-colors hover:bg-accent/50"
                            >
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: resolveLabelColor(
                                    label.color,
                                  ),
                                }}
                              />
                              <span className="max-w-15 truncate">
                                {label.name}
                              </span>
                            </span>
                          ))}
                          {taskLabels.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              No labels
                            </span>
                          )}
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-accent/50"
                          >
                            <Plus className="h-3 w-3" />
                          </span>
                        </span>
                      </TaskLabelsPopover>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                <TaskTitle task={task} />
                <TaskDescription task={task} />
              </div>
            </div>
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
