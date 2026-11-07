import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Layout from "@/components/common/layout";
import { SectionHeader } from "@/components/home/section-header";
import { WeekStrip } from "@/components/home/week-strip";
import { weekWindow } from "@/components/home/build-week";
import { useLocalDay } from "@/hooks/use-local-day";
import { getOpenTasks, getProjects, getProjectsStats } from "@/lib/db/queries";
import { db } from "@/lib/db/db";
import type { ProjectStats } from "@/lib/db/queries";
import type { Project } from "@/lib/db/schema";
import { getDayPart } from "@/lib/day-part";
import { formatLongDate } from "@/lib/format";
import { getProjectIcon } from "@/lib/project-icons";
import { SidebarTriggerHeader } from "@/components/common/sidebar-trigger-header";

export const Route = createFileRoute("/_app/")({
  component: RouteComponent,
});

function HomeSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-9 px-6 py-10 lg:px-10"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-1.5">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-28 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function ProjectCard({
  project,
  stats,
}: {
  project: Project;
  stats: ProjectStats | undefined;
}) {
  const { t } = useTranslation("home");
  const ProjectIcon = getProjectIcon(project.icon);
  const completionPercentage = stats?.completionPercentage ?? 0;
  const totalTasks = stats?.totalTasks ?? 0;

  return (
    <Link
      to="/project/$projectId/board"
      params={{ projectId: project.id }}
      className="flex flex-col gap-3.5 rounded-lg border border-border p-3.5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2">
        <ProjectIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {project.name}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {completionPercentage}%
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand-800"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {t("tasks", { count: totalTasks })}
      </span>
    </Link>
  );
}

function RouteComponent() {
  const { t } = useTranslation("home");
  const projects = useLiveQuery(() => getProjects(), []);
  const statsByProject = useLiveQuery(() => getProjectsStats(db), []);
  const day = useLocalDay();
  const { from, to } = useMemo(() => weekWindow(new Date(day)), [day]);
  const openTasks = useLiveQuery(() => getOpenTasks(db, from, to), [from, to]);

  const now = new Date();
  const dateLine = formatLongDate(now);
  const dayPart = getDayPart(now);

  if (projects === undefined) {
    return (
      <>
        <Layout.Header>
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1">
              <SidebarTriggerHeader />
            </div>
          </div>
        </Layout.Header>
        <Layout.Content>
          <HomeSkeleton />
        </Layout.Content>
      </>
    );
  }

  return (
    <>
      <Layout.Header>
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1">
            <SidebarTriggerHeader />
          </div>
        </div>
      </Layout.Header>
      <Layout.Content>
        <div className="h-full overflow-y-auto">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-9 px-6 py-10 lg:px-10">
            <header className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <p className="text-[13px] font-medium text-muted-foreground">
                  {dateLine}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  {dayPart === "morning"
                    ? t("greeting.morning")
                    : dayPart === "afternoon"
                      ? t("greeting.afternoon")
                      : t("greeting.evening")}
                </h1>
              </div>
            </header>

            <WeekStrip tasks={openTasks ?? []} day={day} />

            <section className="flex flex-col gap-3">
              <SectionHeader title={t("projects.title")} />
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("projects.empty")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      stats={statsByProject?.get(project.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </Layout.Content>
    </>
  );
}
