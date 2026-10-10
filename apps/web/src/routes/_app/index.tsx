import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Folder } from "lucide-react";
import Layout from "@/components/common/layout";
import { countProjectTasks, getProjects } from "@/lib/db/queries";
import type { Project } from "@/lib/db/schema";

export const Route = createFileRoute("/_app/")({
  component: RouteComponent,
});

const skeletonCardKeys = ["skeleton-project-0", "skeleton-project-1"];

function ProjectsSkeleton() {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto px-6 py-10" aria-hidden="true">
      <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        {skeletonCardKeys.map((key) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4"
          >
            <div className="size-9 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const taskCount = useLiveQuery(
    () => countProjectTasks(project.id),
    [project.id],
  );
  return (
    <Link
      to="/project/$projectId/board"
      params={{ projectId: project.id }}
      className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm/5 transition-colors hover:bg-muted/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Folder className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {project.name}
        </span>
        <span className="block text-xs text-muted-foreground">
          {taskCount === undefined ? "…" : `${taskCount} tasks`}
        </span>
      </span>
    </Link>
  );
}

function RouteComponent() {
  const projects = useLiveQuery(() => getProjects(), []);

  if (projects === undefined) {
    return (
      <>
        <Layout.Header>
          <div className="flex items-center gap-1">
            <span className="text-xs font-normal text-card-foreground">
              Projects
            </span>
          </div>
        </Layout.Header>
        <Layout.Content>
          <ProjectsSkeleton />
        </Layout.Content>
      </>
    );
  }

  return (
    <>
      <Layout.Header>
        <div className="flex items-center gap-1">
          <span className="text-xs font-normal text-card-foreground">
            Projects
          </span>
        </div>
      </Layout.Header>
      <Layout.Content>
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto px-6 py-10">
          <h1 className="font-semibold text-3xl tracking-tight">Projects</h1>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No projects yet
              </p>
            )}
          </div>
        </div>
      </Layout.Content>
    </>
  );
}
