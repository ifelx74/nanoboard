import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, List, SquareKanban } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Layout from "@/components/common/layout";
import { getProject } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

export type ProjectView = "board" | "calendar" | "list";

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

  return (
    <>
      <Layout.Header>
        <div className="flex w-full items-center justify-between">
          <div className="flex w-full items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1 h-6 w-6" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-[10px]">Toggle sidebar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="mx-1.5 h-4 w-px shrink-0 bg-border/80" />
            <Breadcrumb className="flex w-full items-center gap-1 text-xs">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">
                    <span className="text-xs font-normal text-card-foreground">
                      nanoboard
                    </span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <span className="text-xs font-normal text-card-foreground">
                    {project?.name ?? "Project"}
                  </span>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
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
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                  activeView === view.key
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <view.icon className="size-3.5" aria-hidden="true" />
                {view.title}
              </button>
            ))}
          </div>
        </div>
      </Layout.Header>
      <Layout.Content>{children}</Layout.Content>
    </>
  );
}
