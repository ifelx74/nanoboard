import { Link } from "@tanstack/react-router";
import { CalendarDays, ChartGantt } from "lucide-react";
import {
  type JSX,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/lib/db/db";
import {
  shiftTaskDates,
  updateTaskDueDate,
  updateTaskStartDate,
} from "@/lib/db/tasks";
import {
  startDate,
  type ColumnSlug,
  type DueDateString,
  type TaskPriority,
} from "@/lib/db/schema";
import { toast } from "@/lib/toast";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getCalendarTaskStatusClass } from "@/components/calendar/calendar-task-bar";
import { cn } from "@/lib/utils";
import {
  formatDayNumber,
  formatMonthYear,
  formatWeekdayNarrow,
} from "@/lib/format";
import { formatDayRange } from "@/lib/due-date-status";
import {
  BAR_HEIGHT,
  DAY_WIDTH,
  ROW_HEIGHT,
  SIDEBAR_WIDTH,
  applyDragDelta,
  clampDragDayDelta,
  type TimelineDragMode,
  type TimelineModel,
  type TimelineRow as TimelineRowModel,
  type TimelineTaskInput,
} from "./timeline-model";
import { useLazyRowMount } from "./use-lazy-row";

export type TimelineGanttTask = TimelineTaskInput & {
  title: string;
  status: ColumnSlug;
  statusName: string;
  isFinal: boolean;
  priority: TaskPriority;
  /** Ticket key (`SLUG-12`); empty until the route resolves the project. */
  key: string;
};

const MONTH_ROW_HEIGHT = 28;
const DAY_ROW_HEIGHT = 36;
/** Rows above the fold render their contents on first paint. */
const INITIAL_MOUNT_ROWS = 16;
/** Pointer travel past which a press on a bar counts as a drag, not a click. */
const DRAG_CLICK_THRESHOLD_PX = 4;

/** Resolves the positioned bar wrapper that parents the grabbed element. */
function positionedBarWrapper(element: HTMLElement): HTMLDivElement | null {
  const parent = element.parentElement;
  return parent instanceof HTMLDivElement ? parent : null;
}

type DragState = {
  pointerId: number;
  mode: TimelineDragMode;
  /** The bar's outer positioned element; mutated directly during the gesture. */
  barPositionedWrapper: HTMLDivElement;
  task: TimelineGanttTask;
  spanDays: number;
  startX: number;
  /** Day-quantised, clamped to the one-day minimum. */
  deltaDays: number;
  originLeft: number;
  originWidth: number;
  moved: boolean;
};

/** Gesture plumbing shared by every row: drag start, move/up/cancel, click suppression. */
type TimelineGesture = {
  onStartDrag: (
    event: ReactPointerEvent<HTMLElement>,
    row: TimelineRowModel<TimelineGanttTask>,
    mode: TimelineDragMode,
  ) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  suppressClickRef: RefObject<boolean>;
};

type TimelineGanttProps = {
  model: TimelineModel<TimelineGanttTask>;
  projectId: string;
  onOpenTask: (taskId: string) => void;
  onEmptyAction: () => void;
};

export default function TimelineGantt({
  model,
  projectId,
  onOpenTask,
  onEmptyAction,
}: TimelineGanttProps): JSX.Element {
  const { t } = useTranslation("timeline");
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const didCenterOnTodayRef = useRef(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    row: TimelineRowModel<TimelineGanttTask>,
    mode: TimelineDragMode,
  ) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // One gesture at a time; a second finger on another bar is ignored.
    if (dragRef.current) return;
    const captureTarget = event.currentTarget;
    const barPositionedWrapper = positionedBarWrapper(captureTarget);
    if (!barPositionedWrapper) return;
    captureTarget.setPointerCapture(event.pointerId);
    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      mode,
      barPositionedWrapper,
      task: row.task,
      spanDays: row.spanDays,
      startX: event.clientX,
      deltaDays: 0,
      originLeft: row.left,
      originWidth: row.width,
      moved: false,
    };
  }

  function applyGestureGeometry(drag: DragState) {
    const offset = drag.deltaDays * DAY_WIDTH;
    if (drag.mode === "move") {
      drag.barPositionedWrapper.style.left = `${drag.originLeft + offset}px`;
      return;
    }
    if (drag.mode === "resize-start") {
      drag.barPositionedWrapper.style.left = `${drag.originLeft + offset}px`;
      drag.barPositionedWrapper.style.width = `${drag.originWidth - offset}px`;
      return;
    }
    drag.barPositionedWrapper.style.width = `${drag.originWidth + offset}px`;
  }

  function restoreGestureGeometry(drag: DragState) {
    drag.barPositionedWrapper.style.left = `${drag.originLeft}px`;
    drag.barPositionedWrapper.style.width = `${drag.originWidth}px`;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const raw = Math.round((event.clientX - drag.startX) / DAY_WIDTH);
    drag.deltaDays = clampDragDayDelta(drag.mode, drag.spanDays, raw);
    if (Math.abs(event.clientX - drag.startX) > DRAG_CLICK_THRESHOLD_PX) {
      drag.moved = true;
    }
    applyGestureGeometry(drag);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (drag.moved) suppressClickRef.current = true;
    void commitGesture(drag);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    restoreGestureGeometry(drag);
  }

  async function commitGesture(drag: DragState) {
    if (drag.deltaDays === 0) return;
    const { task, mode, deltaDays } = drag;
    try {
      if (mode === "move") {
        await shiftTaskDates(db, task.id, deltaDays);
        return;
      }
      const dates = applyDragDelta(task, mode, deltaDays);
      if (mode === "resize-start" && dates.startDate !== undefined) {
        await updateTaskStartDate(task.id, startDate(dates.startDate));
        return;
      }
      if (mode === "resize-end" && dates.dueDate !== undefined) {
        await updateTaskDueDate(task.id, dates.dueDate as DueDateString);
      }
    } catch {
      restoreGestureGeometry(drag);
      toast.error(t("dragRescheduleFailed"));
    }
  }

  function openTaskFromGesture(taskId: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpenTask(taskId);
  }

  const scrollToToday = (behavior: ScrollBehavior) => {
    const container = scrollRef.current;
    const todayIndex = model.days.findIndex((day) => day.isToday);
    if (!container || todayIndex < 0) return;
    const visibleChart = container.clientWidth - SIDEBAR_WIDTH;
    const target = todayIndex * DAY_WIDTH + DAY_WIDTH / 2 - visibleChart / 2;
    container.scrollTo({ left: Math.max(0, target), behavior });
  };

  // Centre the viewport on today on mount so the current period is in view
  // even when the range extends far into the past. Runs once: later model
  // rebuilds (a drag commit or a drawer date edit) must not yank the
  // viewport away from where the user just acted. The Today button
  // re-centres on demand via `scrollToToday`.
  useEffect(() => {
    if (didCenterOnTodayRef.current) return;
    didCenterOnTodayRef.current = true;
    const container = scrollRef.current;
    const todayIndex = model.days.findIndex((day) => day.isToday);
    if (!container || todayIndex < 0) return;
    const visibleChart = container.clientWidth - SIDEBAR_WIDTH;
    const target = todayIndex * DAY_WIDTH + DAY_WIDTH / 2 - visibleChart / 2;
    container.scrollTo({ left: Math.max(0, target) });
  }, [model]);

  const hasRows = model.rows.length > 0;
  const gesture: TimelineGesture = {
    onStartDrag: startDrag,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    suppressClickRef,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-3 py-2 sm:px-4">
        <h1 className="truncate text-sm font-semibold text-foreground">
          {t("title")}
        </h1>
        <Button
          variant="outline"
          size="xs"
          className="min-h-11 touch-manipulation sm:min-h-0"
          onClick={() => scrollToToday("smooth")}
        >
          {t("today")}
        </Button>
      </div>

      {model.undatedCount > 0 && (
        <div className="border-b border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground sm:px-4">
          <span>{t("undatedNote", { count: model.undatedCount })} </span>
          <Link
            to="/project/$projectId/board"
            params={{ projectId }}
            className="font-medium underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {t("undatedNoteLink")}
          </Link>
        </div>
      )}

      {!hasRows ? (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/20 p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12">
                <ChartGantt className="size-6" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center gap-2">
              <Button size="sm" onClick={onEmptyAction}>
                {t("emptyAction")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto overscroll-x-contain"
        >
          <div
            className="relative"
            style={{ width: SIDEBAR_WIDTH + model.chartWidth }}
          >
            {/* Sticky two-row header: month labels above weekday/day cells. */}
            <div className="sticky top-0 z-30">
              <div
                className="flex border-b border-border bg-background"
                style={{ height: MONTH_ROW_HEIGHT }}
              >
                <div
                  className="sticky left-0 z-10 h-full shrink-0 border-r border-border bg-background"
                  style={{ width: SIDEBAR_WIDTH }}
                />
                <div
                  className="relative h-full shrink-0"
                  style={{ width: model.chartWidth }}
                >
                  {model.months.map((month) => (
                    <div
                      key={month.key}
                      title={formatMonthYear(month.date)}
                      className="absolute top-0 flex h-full items-center overflow-hidden border-r border-border/60 px-2 text-[11px] font-medium text-foreground"
                      style={{
                        left: month.startIndex * DAY_WIDTH,
                        width: month.dayCount * DAY_WIDTH,
                      }}
                    >
                      <span className="truncate">
                        {formatMonthYear(month.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="flex border-b border-border bg-background"
                style={{ height: DAY_ROW_HEIGHT }}
              >
                <div
                  className="sticky left-0 z-10 flex h-full shrink-0 items-end border-r border-border bg-background px-3 pb-1.5"
                  style={{ width: SIDEBAR_WIDTH }}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("task")}
                  </span>
                </div>
                <div
                  className="flex h-full shrink-0"
                  style={{ width: model.chartWidth }}
                >
                  {model.days.map((day) => (
                    <div
                      key={day.index}
                      className={cn(
                        "flex h-full w-10 shrink-0 flex-col items-center justify-center border-r border-border/50",
                        day.isWeekend && "bg-muted/40",
                        day.isToday && "bg-primary/10",
                      )}
                    >
                      <span className="text-[9px] font-medium uppercase leading-none text-muted-foreground">
                        {formatWeekdayNarrow(day.date)}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] leading-tight tabular-nums text-foreground",
                          day.isToday && "font-bold text-primary",
                        )}
                      >
                        {formatDayNumber(day.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rows: one flex component each — sticky sidebar cell + chart
                cell — inside the shared overflow container. */}
            <div className="relative">
              {/* Weekend / today tint columns behind the bars. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-0"
                style={{ left: SIDEBAR_WIDTH, width: model.chartWidth }}
              >
                {model.days.map((day) =>
                  day.isWeekend || day.isToday ? (
                    <div
                      key={day.index}
                      className={cn(
                        "absolute inset-y-0",
                        day.isToday ? "bg-primary/10" : "bg-muted/30",
                      )}
                      style={{
                        left: day.index * DAY_WIDTH,
                        width: DAY_WIDTH,
                      }}
                    />
                  ) : null,
                )}
              </div>

              {model.rows.map((row, index) => (
                <TimelineRow
                  key={row.task.id}
                  row={row}
                  index={index}
                  chartWidth={model.chartWidth}
                  rootRef={scrollRef}
                  onOpenTask={onOpenTask}
                  onOpenFromGesture={openTaskFromGesture}
                  gesture={gesture}
                  isActive={activeRowId === row.task.id}
                  onActiveRowChange={setActiveRowId}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type TimelineRowProps = {
  row: TimelineRowModel<TimelineGanttTask>;
  index: number;
  chartWidth: number;
  rootRef: RefObject<HTMLDivElement | null>;
  onOpenTask: (taskId: string) => void;
  onOpenFromGesture: (taskId: string) => void;
  gesture: TimelineGesture;
  /** Whether this row is the shared active (hovered/focused) row. */
  isActive: boolean;
  onActiveRowChange: (taskId: string | null) => void;
};

function TimelineRow({
  row,
  index,
  chartWidth,
  rootRef,
  onOpenTask,
  onOpenFromGesture,
  gesture,
  isActive,
  onActiveRowChange,
}: TimelineRowProps): JSX.Element {
  const { t } = useTranslation("timeline");
  const { t: tCommon } = useTranslation("common");
  const { rowRef, mounted } = useLazyRowMount(rootRef, {
    initiallyMounted: index < INITIAL_MOUNT_ROWS,
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const { task } = row;
  const range = formatDayRange(task.chartStart, task.chartEnd);
  const label = task.key ? `${task.key} · ${task.title}` : task.title;
  const priorityLabels: Record<TaskPriority, string> = {
    urgent: tCommon("priority.urgent"),
    high: tCommon("priority.high"),
    medium: tCommon("priority.medium"),
    low: tCommon("priority.low"),
    "no-priority": tCommon("priority.noPriority"),
  };
  const priorityText = priorityLabels[task.priority];

  return (
    <div
      ref={rowRef}
      className="relative z-10 flex border-b border-border/60"
      style={{ height: ROW_HEIGHT }}
      onMouseEnter={() => onActiveRowChange(task.id)}
      onMouseLeave={() => onActiveRowChange(null)}
      onFocus={() => onActiveRowChange(task.id)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) {
          return;
        }
        onActiveRowChange(null);
      }}
    >
      {mounted && (
        <>
          <div
            className="sticky left-0 z-20 h-full shrink-0 border-r border-border bg-background"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {isActive && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-accent"
              />
            )}
            <button
              type="button"
              onClick={() => onOpenTask(task.id)}
              className="relative flex h-full w-full items-center gap-2 px-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-6 w-1.5 shrink-0 rounded-full border",
                  getCalendarTaskStatusClass(task.status),
                )}
              />
              {task.key && (
                <span className="w-14 shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                  {task.key}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {task.title}
              </span>
            </button>
          </div>
          <div
            className={cn(
              "relative h-full shrink-0 transition-colors",
              isActive && "bg-accent/50",
            )}
            style={{ width: chartWidth }}
          >
            <div
              className="absolute z-10 touch-none select-none"
              style={{
                left: row.left,
                width: row.width,
                top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                height: BAR_HEIGHT,
              }}
              onPointerMove={gesture.onPointerMove}
              onPointerUp={gesture.onPointerUp}
              onPointerCancel={gesture.onPointerCancel}
              onClick={() => {
                // Swallow the post-drag click on handles/edges so a
                // drag never leaks a stale flag into a later click.
                gesture.suppressClickRef.current = false;
              }}
            >
              <Tooltip open={previewOpen} onOpenChange={setPreviewOpen}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("taskBarLabel", { label, range })}
                    data-task-status={task.status}
                    onPointerDown={(event) => {
                      setPreviewOpen(false);
                      gesture.onStartDrag(event, row, "move");
                    }}
                    onClick={() => onOpenFromGesture(task.id)}
                    className={cn(
                      "absolute inset-0 flex cursor-grab items-center overflow-hidden rounded-md border px-2 text-left text-[11px] font-medium leading-none text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                      getCalendarTaskStatusClass(task.status),
                    )}
                  >
                    <span
                      className="pointer-events-none min-w-0 flex-1 truncate"
                      style={{ position: "sticky", left: SIDEBAR_WIDTH }}
                    >
                      {task.title}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={8}
                  className="pointer-events-none w-72 [--viewport-inline-padding:0px]"
                >
                  <div className="space-y-1.5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{task.key}</span>
                      <span aria-hidden="true">·</span>
                      {getColumnIcon(task.status, task.isFinal)}
                      <span className="truncate">{task.statusName}</span>
                      <span className="ml-auto flex items-center gap-1">
                        {getPriorityIcon(task.priority)}
                        <span className="sr-only">{priorityText}</span>
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-snug">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CalendarDays
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{range}</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              <div
                aria-hidden="true"
                onPointerDown={(event) =>
                  gesture.onStartDrag(event, row, "resize-start")
                }
                className="absolute left-0 top-0 z-10 h-full w-3 cursor-ew-resize"
              />
              <div
                aria-hidden="true"
                onPointerDown={(event) =>
                  gesture.onStartDrag(event, row, "resize-end")
                }
                className="absolute right-0 top-0 z-10 h-full w-3 cursor-ew-resize"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
