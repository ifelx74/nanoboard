import { createFileRoute, Link } from "@tanstack/react-router";
import { Folder } from "lucide-react";
import Layout from "@/components/common/layout";
import { mockProjects, getProjectTasks } from "@/lib/mock";

export const Route = createFileRoute("/_app/")({
  component: RouteComponent,
});

function RouteComponent() {
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
            {mockProjects.map((project) => {
              const taskCount = getProjectTasks(project.id).length;
              return (
                <Link
                  key={project.id}
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
                      {taskCount} tasks
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </Layout.Content>
    </>
  );
}
