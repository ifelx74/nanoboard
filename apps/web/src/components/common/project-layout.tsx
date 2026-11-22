import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Calendar,
  ChartGantt,
  ChevronsUpDown,
  ClipboardClock,
  FileText,
  List,
  SplinePointer,
  SquareKanban,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export type ProjectView =
  | "board"
  | "calendar"
  | "list"
  | "pages"
  | "whiteboard"
  | "archives"
  | "timeline";
export type ProjectLayoutView = "backlog" | "whiteboard";

type ViewMeta = { key: ProjectView; title: string; icon: typeof List };

type ProjectLayoutProps = {
  projectId: string;
  activeView: ProjectView;
  children: ReactNode;
  archiveCount?: number;
  /** Additional breadcrumb items rendered after the project view switcher. */
  breadcrumbExtra?: ReactNode;
  /** Right-side header controls rendered for non-backlog surfaces (e.g. Pages). */
  headerActions?: ReactNode;
};

export function ProjectLayout({
  projectId,
  activeView,
  children,
  archiveCount = 0,
  breadcrumbExtra,
  headerActions,
}: ProjectLayoutProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("project");
  const views: ViewMeta[] = [
    { key: "board", title: t("toolbar.board"), icon: SquareKanban },
    { key: "calendar", title: t("toolbar.calendar"), icon: Calendar },
    { key: "list", title: t("toolbar.list"), icon: List },
    { key: "timeline", title: t("toolbar.timeline"), icon: ChartGantt },
  ];
  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  // is backlog view if activeView is board, calendar, list, or timeline
  const isBacklogView = ["board", "calendar", "list", "timeline"].includes(
    activeView,
  );
  const isPagesView = activeView === "pages";
  const isArchivesView = activeView === "archives";
  const activeViewLabel = isBacklogView
    ? t("toolbar.backlog")
    : isPagesView
      ? t("toolbar.pages")
      : isArchivesView
        ? t("toolbar.archives")
        : t("toolbar.whiteboard");

  return (
    <>
      <Layout.Header>
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <SidebarTriggerHeader triggerClassName="-ml-1 h-6 w-6 shrink-0" />
            <Breadcrumb className="flex min-w-0 items-center gap-1 text-xs">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem className="hidden shrink-0 sm:inline-flex">
                  <span className="max-w-44 truncate text-xs font-semibold text-card-foreground">
                    {project?.name ?? t("toolbar.fallbackProject")}
                  </span>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden shrink-0 sm:inline-flex" />
                <BreadcrumbItem className="shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-1.5 py-0.5 text-sm"
                        >
                          {activeViewLabel}
                          {isArchivesView && archiveCount > 0 && (
                            <span
                              aria-label={t("toolbar.archivedTasks", {
                                count: archiveCount,
                              })}
                              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 text-[11px] font-semibold tabular-nums text-brand-800 dark:bg-brand-900 dark:text-brand-100"
                            >
                              {archiveCount}
                            </span>
                          )}
                          <ChevronsUpDown className="size-3 text-foreground/70" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent
                      className="w-52 rounded-sm"
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
                        {t("toolbar.backlog")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        key={"pages"}
                        onClick={() =>
                          navigate({
                            to: `/project/$projectId/pages`,
                            params: { projectId },
                          })
                        }
                      >
                        <FileText />
                        {t("toolbar.pages")}
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
                        <SplinePointer />
                        {t("toolbar.whiteboard")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        key={"archives"}
                        onClick={() =>
                          navigate({
                            to: `/project/$projectId/archives`,
                            params: { projectId },
                          })
                        }
                      >
                        <Archive />
                        {t("toolbar.archives")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </BreadcrumbItem>
                {breadcrumbExtra}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {isBacklogView ? (
            <div className="flex shrink-0 items-center gap-1">
              {views.map((view) => (
                <Tooltip key={view.key}>
                  <TooltipTrigger
                    render={
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
                          "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors cursor-pointer",
                          activeView === view.key
                            ? "bg-brand-100 dark:bg-brand-900 text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-brand-100 dark:hover:bg-brand-800 hover:text-foreground",
                        )}
                      >
                        <view.icon className="size-3.5" aria-hidden="true" />
                      </button>
                    }
                  />
                  <TooltipContent>
                    <span>{view.title}</span>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : headerActions ? (
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
            </div>
          ) : isArchivesView ? (
            <div className="flex shrink-0 items-center" />
          ) : null}
        </div>
      </Layout.Header>

      <Layout.Content>{children}</Layout.Content>
    </>
  );
}
