import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronsUpDown,
  ClipboardClock,
  List,
  PencilSparkles,
  SquareKanban,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Layout from "@/components/common/layout";
import { SidebarTriggerHeader } from "@/components/common/sidebar-trigger-header";
import { getProject } from "@/lib/db/queries";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";

export type ProjectView = "board" | "calendar" | "list" | "whiteboard";
export type ProjectLayoutView = "backlog" | "whiteboard";

const views: { key: ProjectView; title: string; icon: typeof List }[] = [
  { key: "board", title: "Board", icon: SquareKanban },
  { key: "calendar", title: "Calendar", icon: CalendarDays },
  { key: "list", title: "List", icon: List },
];

type ProjectLayoutProps = {
  projectId: string;
  activeView: ProjectView;
  children: ReactNode;
};

export function ProjectLayout({
  projectId,
  activeView,
  children,
}: ProjectLayoutProps) {
  const navigate = useNavigate();
  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  // is backlog view if activeView is board, calendar, or list
  const isBacklogView = ["board", "calendar", "list"].includes(activeView);

  return (
    <>
      <Layout.Header>
        <div className="flex w-full items-center justify-between">
          <div className="flex w-full items-center gap-1">
            <SidebarTriggerHeader triggerClassName="-ml-1 h-6 w-6" />
            <Breadcrumb className="flex w-full items-center gap-1 text-xs">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <span className="text-xs font-semibold text-card-foreground">
                    {project?.name ?? "Project"}
                  </span>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-1.5 py-0.5 text-sm"
                      >
                        {isBacklogView ? "Backlog" : "Whiteboard"}
                        <ChevronsUpDown className="size-3 text-foreground/70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-44 rounded-sm"
                      align="start"
                      side="bottom"
                    >
                      <DropdownMenuItem
                        key={"backlog"}
                        onClick={() =>
                          navigate({
                            to: `/project/$projectId/board`,
                            params: { projectId },
                          })
                        }
                      >
                        <ClipboardClock />
                        Backlog
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        key={"whiteboard"}
                        onClick={() =>
                          navigate({
                            to: `/project/$projectId/whiteboard`,
                            params: { projectId },
                          })
                        }
                      >
                        <PencilSparkles />
                        Whiteboard
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {isBacklogView ? (
            <div className="flex items-center gap-1">
              {views.map((view) => (
                <button
                  key={view.key}
                  type="button"
                  onClick={() =>
                    navigate({
                      to: `/project/$projectId/${view.key}`,
                      params: { projectId },
                    })
                  }
                  title={view.title}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                    activeView === view.key
                      ? "bg-brand-100 dark:bg-brand-900 text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-brand-100 dark:hover:bg-brand-800 hover:text-foreground",
                  )}
                >
                  <view.icon className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:block">{view.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </Layout.Header>
      <Layout.Content>{children}</Layout.Content>
    </>
  );
}
