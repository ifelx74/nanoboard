import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import Layout from "@/components/common/layout";
import { SectionHeader } from "@/components/home/section-header";
import { getProjects, getProjectsStats } from "@/lib/db/queries";
import type { ProjectStats } from "@/lib/db/queries";
import type { Project } from "@/lib/db/schema";
import { getDayPart } from "@/lib/day-part";
import { getProjectIcon } from "@/lib/project-icons";

export const Route = createFileRoute("/_app/")({
  component: RouteComponent,
});

const GREETINGS = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
} as const;

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
          className="h-full rounded-full bg-brand-900"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {totalTasks === 1 ? "1 task" : `${totalTasks} tasks`}
      </span>
    </Link>
  );
}

function RouteComponent() {
  const projects = useLiveQuery(() => getProjects(), []);
  const statsByProject = useLiveQuery(() => getProjectsStats(), []);
  const now = new Date();
  const dateLine = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (projects === undefined) {
    return (
      <>
        <Layout.Header>
          <div className="flex items-center gap-1">
            <span className="text-xs font-normal text-card-foreground">
              Home
            </span>
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
        <div className="flex items-center gap-1">
          <span className="text-xs font-normal text-card-foreground">Home</span>
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
                  {GREETINGS[getDayPart(now)]}
                </h1>
              </div>
            </header>

            <section className="flex flex-col gap-3">
              <SectionHeader title="Projects" />
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects yet</p>
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
