import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ProjectLayout } from "@/components/common/project-layout";
import { getProjectTasks } from "@/lib/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/project/$projectId/calendar")({
  component: RouteComponent,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function RouteComponent() {
  const { projectId } = Route.useParams();
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const tasks = getProjectTasks(projectId);
  const byDate = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const list = byDate.get(task.dueDate) ?? [];
    list.push(task);
    byDate.set(task.dueDate, list);
  }

  const monthLabel = view.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <ProjectLayout projectId={projectId} activeView="calendar">
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">{monthLabel}</h2>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setOffset((o) => o - 1)}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="h-7 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setOffset((o) => o + 1)}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-xl border border-border/80 bg-border/50">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {monthCells(view.getFullYear(), view.getMonth()).map((date, i) => {
            const dayTasks = date ? (byDate.get(toISODate(date)) ?? []) : [];
            const isToday =
              date?.toDateString() === new Date().toDateString();
            return (
              <div
                key={date ? date.toISOString() : `empty-${i}`}
                className="min-h-20 bg-background p-1.5"
              >
                {date && (
                  <>
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                        isToday
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <div className="mt-1 flex flex-col gap-1">
                      {dayTasks.slice(0, 2).map((task) => (
                        <span
                          key={task.id}
                          className="truncate rounded-md bg-muted px-1.5 py-0.5 text-xs"
                        >
                          {task.title}
                        </span>
                      ))}
                      {dayTasks.length > 2 && (
                        <span className="px-1 text-[11px] text-muted-foreground">
                          +{dayTasks.length - 2} more
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ProjectLayout>
  );
}
