import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addMonths, startOfMonth, subMonths } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { ProjectLayout } from "@/components/common/project-layout";
import CalendarToolbar from "@/components/calendar/calendar-toolbar";
import MonthGrid from "@/components/calendar/month-grid";
import type { CalendarTask } from "@/components/calendar/calendar-task-bar";
import { buildMonthWeeks } from "@/components/calendar/month-grid-model";
import TaskDrawer from "@/components/task/task-drawer";
import { getProjectTasks } from "@/lib/db/queries";

export const Route = createFileRoute("/_app/project/$projectId/calendar")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { task?: string } => ({
    task: typeof search.task === "string" ? search.task : undefined,
  }),
});

// Lanes are capped so a busy week cannot push a row taller than the viewport;
// anything past the cap surfaces as a per-day overflow hint.
const MAX_LANES_DESKTOP = 3;
const MAX_LANES_MOBILE = 2;

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Mirrors Kaneo's desktop/mobile lane cap without a viewport hook. */
function useMaxLanes(): number {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 640px)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const onChange = (event: MediaQueryListEvent) =>
      setIsDesktop(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isDesktop ? MAX_LANES_DESKTOP : MAX_LANES_MOBILE;
}

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { task: selectedTaskId } = Route.useSearch();
  const navigate = useNavigate();
  const tasks = useLiveQuery(() => getProjectTasks(projectId), [projectId]);
  const maxLanes = useMaxLanes();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );

  // v1 tasks carry a due date only, so every bar is a single day. A future
  // startDate would feed scheduleStart here for spanning bars.
  const scheduledTasks: CalendarTask[] = useMemo(
    () =>
      (tasks ?? [])
        .filter((task) => task.dueDate)
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          scheduleStart: parseLocalDate(task.dueDate as string),
          scheduleEnd: parseLocalDate(task.dueDate as string),
        })),
    [tasks],
  );

  // Sunday-first, matching the previous view. A Monday-first preference
  // (Kaneo's weekStartsOn) is parked alongside startDate.
  const weeks = useMemo(() => buildMonthWeeks(visibleMonth, 0), [visibleMonth]);

  function openTask(taskId: string) {
    void navigate({
      to: "/project/$projectId/calendar",
      params: { projectId },
      search: { task: taskId },
    });
  }

  function closeTask() {
    void navigate({
      to: "/project/$projectId/calendar",
      params: { projectId },
      search: {},
    });
  }

  if (tasks === undefined) {
    return (
      <ProjectLayout projectId={projectId} activeView="calendar">
        <div className="flex h-full flex-col" aria-hidden="true">
          <div className="border-b border-border/80 px-3 py-3 sm:px-4">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid flex-1 grid-cols-7 gap-px bg-border/50 p-px">
            {Array.from({ length: 35 }, (_, i) => `skeleton-cell-${i}`).map(
              (key) => (
                <div key={key} className="min-h-24 animate-pulse bg-muted/40" />
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
    <ProjectLayout projectId={projectId} activeView="calendar">
      <div className="flex h-full min-h-0 flex-col">
        <CalendarToolbar
          visibleMonth={visibleMonth}
          onPreviousMonth={() =>
            setVisibleMonth((current) => subMonths(current, 1))
          }
          onNextMonth={() =>
            setVisibleMonth((current) => addMonths(current, 1))
          }
          onToday={() => setVisibleMonth(startOfMonth(new Date()))}
        />
        <MonthGrid
          weeks={weeks}
          tasks={scheduledTasks}
          visibleMonth={visibleMonth}
          maxLanes={maxLanes}
          onOpenTask={openTask}
        />
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
