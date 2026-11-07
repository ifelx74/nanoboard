import { useLiveQuery } from "dexie-react-hooks";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetPanel, SheetPopup } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  duplicateTask,
  getProject,
  getProjectColumns,
  getTask,
  getTaskLabels,
  isTaskArchived,
  restoreTask,
} from "@/lib/db/queries";
import { getColumnIcon } from "@/lib/column";
import { getDueDateStatus, parseLocalDate } from "@/lib/due-date-status";
import { db } from "@/lib/db/db";
import { formatDateShort } from "@/lib/due-date-status";
import type { TaskPriority } from "@/lib/db/schema";
import { resolveLabelColor } from "@/lib/label-color";
import { i18n } from "@/lib/i18n";
import { getPriorityIcon } from "@/lib/priority";
import { taskKey } from "@/lib/task-key";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import TaskArchiveDialog from "./task-archive-dialog";
import TaskColumnPopover from "./task-column-popover";
import TaskDeleteDialog from "./task-delete-dialog";
import TaskDescription, {
  type DescriptionSaveStatus,
} from "./task-description";
import TaskDueDatePopover from "./task-due-date-popover";
import TaskLabelsPopover from "./task-labels-popover";
import TaskPriorityPopover from "./task-priority-popover";
import TaskResources from "./task-resources";
import TaskStartDatePopover from "./task-start-date-popover";
import TaskTitle from "./task-title";

const DUE_ICON_CLASS: Record<string, string> = {
  overdue: "text-destructive-foreground",
  "due-soon": "text-warning-foreground",
  "far-future": "text-muted-foreground",
  "no-due-date": "text-muted-foreground",
};

function DisabledHintButton({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="button"
            aria-disabled="true"
            tabIndex={0}
            aria-label={label}
            className="inline-flex cursor-not-allowed rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <span aria-hidden="true">{children}</span>
      </TooltipTrigger>
      <TooltipPopup>{tooltip}</TooltipPopup>
    </Tooltip>
  );
}

function DescriptionSaveIndicator({
  status,
  onRetry,
}: {
  status: DescriptionSaveStatus;
  onRetry: () => void;
}) {
  const { t } = useTranslation("task");
  const [savedVisible, setSavedVisible] = useState(false);

  useEffect(() => {
    if (status !== "saved") {
      setSavedVisible(false);
      return undefined;
    }

    setSavedVisible(true);
    const timer = setTimeout(() => setSavedVisible(false), 1000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <span className="flex items-center" aria-live="polite">
      {status === "saving" && (
        <>
          <Loader2
            className="size-3.5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">{t("drawer.descriptionSaving")}</span>
        </>
      )}
      {status === "failed" && (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-destructive hover:text-destructive"
            aria-label={t("drawer.retrySaving")}
            title={t("drawer.retry")}
            onClick={onRetry}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
          <span className="sr-only">{t("drawer.descriptionFailed")}</span>
        </>
      )}
      {status === "saved" && savedVisible && (
        <>
          <Check
            className="size-3.5 text-success-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">{t("drawer.descriptionSaved")}</span>
        </>
      )}
    </span>
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
  const { t } = useTranslation("task");
  const priorityNames: Record<TaskPriority, string> = {
    "no-priority": t("priority.noPriority"),
    low: t("priority.low"),
    medium: t("priority.medium"),
    high: t("priority.high"),
    urgent: t("priority.urgent"),
  };
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>(
    taskId,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [descriptionStatus, setDescriptionStatus] =
    useState<DescriptionSaveStatus>("idle");
  const descriptionRetryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setDescriptionStatus("idle");
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
  const columns = useLiveQuery(
    () => getProjectColumns(db, projectId),
    [projectId],
  );
  const taskLabels = useLiveQuery(
    () => (currentTaskId ? getTaskLabels(currentTaskId) : undefined),
    [currentTaskId],
  );

  const archived = task !== undefined && isTaskArchived(task);

  useEffect(() => {
    if (archived) setArchiveOpen(false);
  }, [archived]);

  async function handleDuplicate() {
    if (!task || duplicating || archived) return;
    setDuplicating(true);
    try {
      const id = await duplicateTask(task.id);
      onSelectTask(id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("task:drawer.errors.duplicate"),
      );
    } finally {
      setDuplicating(false);
    }
  }

  async function handleRestore() {
    if (!task || restoring) return;
    setRestoring(true);
    try {
      await restoreTask(db, task.id);
      const message = i18n.t("task:drawer.restored");
      toast.success(message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("task:drawer.errors.restore"),
      );
    } finally {
      setRestoring(false);
    }
  }

  function handleCopyLink() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          const message = i18n.t("task:drawer.linkCopied");
          toast.message(message);
        })
        .catch(() => {
          const message = i18n.t("task:drawer.errors.copyLink");
          toast.error(message);
        });
      return;
    }
    const message = i18n.t("task:drawer.errors.copyUnsupported");
    toast.error(message);
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

  const taskKeyText =
    project && task
      ? taskKey(project.slug, task.number)
      : (project?.slug.toUpperCase() ?? "");

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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {taskKeyText}
            </span>
            {archived && (
              <Badge variant="secondary" className="gap-1">
                <Archive className="size-3" aria-hidden="true" />
                {t("drawer.archived")}
              </Badge>
            )}
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("drawer.copyLink")}
                title={t("drawer.copyLink")}
                onClick={handleCopyLink}
                className="text-foreground"
              >
                <Link2 className="size-4" aria-hidden="true" />
              </Button>
              {archived ? (
                <DisabledHintButton
                  label={t("drawer.duplicate")}
                  tooltip={t("drawer.duplicateHint")}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="text-foreground"
                  >
                    <Copy className="size-4" aria-hidden="true" />
                  </Button>
                </DisabledHintButton>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("drawer.duplicate")}
                  title={t("drawer.duplicate")}
                  disabled={!task || duplicating}
                  onClick={() => void handleDuplicate()}
                  className="text-foreground"
                >
                  <Copy className="size-4" aria-hidden="true" />
                </Button>
              )}
              {archived ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("drawer.restore")}
                  title={t("drawer.restore")}
                  disabled={!task || restoring}
                  onClick={() => void handleRestore()}
                  className="text-foreground"
                >
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                </Button>
              ) : taskIsFinal ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("drawer.archive")}
                  title={t("drawer.archive")}
                  disabled={!task}
                  onClick={() => setArchiveOpen(true)}
                  className="text-foreground"
                >
                  <Archive className="size-4" aria-hidden="true" />
                </Button>
              ) : (
                <DisabledHintButton
                  label={t("drawer.archive")}
                  tooltip={t("drawer.archiveHint")}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="text-foreground"
                  >
                    <Archive className="size-4" aria-hidden="true" />
                  </Button>
                </DisabledHintButton>
              )}
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("drawer.delete")}
                title={t("drawer.delete")}
                disabled={!task}
                onClick={() => setDeleteOpen(true)}
                className="text-foreground"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("drawer.close")}
                title={t("drawer.close")}
                onClick={onClose}
                className="text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </TooltipProvider>
        </div>

        {currentTaskId && (
          <TaskArchiveDialog
            key={currentTaskId}
            open={archiveOpen}
            onOpenChange={setArchiveOpen}
            taskId={currentTaskId}
            taskKeyText={taskKeyText}
            taskTitle={task?.title ?? ""}
          />
        )}
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
                  <TaskColumnPopover
                    task={task}
                    columns={columns}
                    disabled={archived}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 justify-start gap-1.5 px-1.5"
                      disabled={archived}
                    >
                      {getColumnIcon(task.status, taskIsFinal)}
                      <span className="truncate text-xs font-semibold">
                        {taskColumn?.name ?? task.status}
                      </span>
                    </Button>
                  </TaskColumnPopover>
                  <TaskPriorityPopover task={task} disabled={archived}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 justify-start gap-1.5 px-1.5"
                      disabled={archived}
                    >
                      {getPriorityIcon(task.priority)}
                      <span className="truncate text-xs font-semibold">
                        {priorityNames[task.priority]}
                      </span>
                    </Button>
                  </TaskPriorityPopover>
                  <TaskStartDatePopover task={task} disabled={archived}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 justify-start gap-1.5 px-1.5"
                      disabled={archived}
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
                          : t("drawer.start")}
                      </span>
                    </Button>
                  </TaskStartDatePopover>
                  <TaskDueDatePopover task={task} disabled={archived}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 justify-start gap-1.5 px-1.5"
                      disabled={archived}
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
                            {t("drawer.noDate")}
                          </span>
                        </>
                      )}
                    </Button>
                  </TaskDueDatePopover>
                </div>

                <div className="flex flex-col gap-3 px-3 p-2">
                  <div className="flex flex-col gap-1">
                    <span className="px-2 text-xs font-medium text-foreground/70">
                      {t("drawer.labelsHeading")}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 px-2">
                      <TaskLabelsPopover task={task} disabled={archived}>
                        <span
                          className={cn(
                            "flex min-w-0 flex-wrap items-center gap-1.5",
                            !archived && "cursor-pointer",
                          )}
                        >
                          {taskLabels.map((label) => (
                            <span
                              key={label.id}
                              className={cn(
                                "flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] transition-colors",
                                !archived && "hover:bg-accent/50",
                              )}
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
                              {t("drawer.noLabels")}
                            </span>
                          )}
                          {!archived && (
                            <span
                              aria-hidden="true"
                              className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-accent/50"
                            >
                              <Plus className="h-3 w-3" />
                            </span>
                          )}
                        </span>
                      </TaskLabelsPopover>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                {project && (
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground/70">
                      {taskKeyText}
                    </p>
                    <DescriptionSaveIndicator
                      status={descriptionStatus}
                      onRetry={() => descriptionRetryRef.current?.()}
                    />
                  </div>
                )}
                <TaskTitle task={task} disabled={archived} />
                <TaskDescription
                  task={task}
                  disabled={archived}
                  onStatusChange={setDescriptionStatus}
                  retryRef={descriptionRetryRef}
                />
                <TaskResources taskId={task.id} disabled={archived} />
              </div>
            </div>
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
