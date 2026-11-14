import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Archive,
  ArrowUpFromLine,
  ChevronRight,
  FileDown,
  Folder,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import CreateProjectDialog from "@/components/project/create-project-dialog";
import EditProjectDialog from "@/components/project/edit-project-dialog";
import ProjectDeleteDialog from "@/components/project/project-delete-dialog";
import { ProjectProgress } from "@/components/project/project-progress";
import { getProjects, getProjectsStats } from "@/lib/db/queries";
import type { ProjectStats } from "@/lib/db/queries";
import { db } from "@/lib/db/db";
import type { Project } from "@/lib/db/schema";
import { getProjectIcon } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

// The transfer dialogs (which pull the crypto envelope module into their
// chunks) load on first open instead of shipping with the app shell.
const ExportTasksDialog = lazy(() =>
  import("@/components/project/tasks-import-export/export-tasks-dialog").then(
    (m) => ({ default: m.ExportTasksDialog }),
  ),
);
const ImportTasksDialog = lazy(() =>
  import("@/components/project/tasks-import-export/import-tasks-dialog").then(
    (m) => ({ default: m.ImportTasksDialog }),
  ),
);

function ProjectRow({
  project,
  stats,
  isActive,
  onDeleted,
}: {
  project: Project;
  stats: ProjectStats | undefined;
  isActive: boolean;
  onDeleted: (projectId: string) => void;
}) {
  const { t } = useTranslation("navigation");
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Latched on first open so the lazy dialog chunks load on demand but stay
  // mounted afterwards (keeping open/close animations).
  const [hasOpenedImport, setHasOpenedImport] = useState(false);
  const [hasOpenedExport, setHasOpenedExport] = useState(false);
  const ProjectIcon = getProjectIcon(project.icon);

  function openBoard() {
    void navigate({
      to: "/project/$projectId/board",
      params: { projectId: project.id },
    });
  }

  function openArchives() {
    void navigate({
      to: "/project/$projectId/archives",
      params: { projectId: project.id },
    });
  }

  function handleDeleteRequest() {
    setMenuOpen(false);
    setDeleteOpen(true);
  }

  return (
    <SidebarMenuItem className="group/menu-item relative">
      <SidebarMenuButton
        isActive={isActive}
        size="default"
        className="peer/menu-button h-8 text-sm"
        onClick={openBoard}
      >
        <ProjectIcon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        {/* Gives way to the row menu, which sits here on hover. */}
        <ProjectProgress
          percentage={stats?.completionPercentage ?? 0}
          className="text-muted-foreground max-md:hidden group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0 group-has-data-popup-open/menu-item:opacity-0"
        />
      </SidebarMenuButton>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          aria-label={t("projects.moreActions", { name: project.name })}
          className="absolute top-1.5 right-1 cursor-pointer flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring transition-transform outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground data-popup-open:opacity-100 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 md:opacity-0"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44" align="start" side="right">
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              openBoard();
            }}
          >
            <Folder className="size-4 shrink-0" />
            <span>{t("projects.view")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4 shrink-0" />
            <span>{t("projects.edit")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              setHasOpenedExport(true);
              setExportOpen(true);
            }}
          >
            <ArrowUpFromLine className="size-4 shrink-0" />
            <span>{t("projects.export")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              setHasOpenedImport(true);
              setImportOpen(true);
            }}
          >
            <FileDown className="size-4 shrink-0" />
            <span>{t("projects.import")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              openArchives();
            }}
          >
            <Archive className="size-4 shrink-0" />
            <span>{t("projects.archives")}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleDeleteRequest}>
            <Trash2 className="size-4 shrink-0" />
            <span>{t("projects.delete")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectId={project.id}
        projectName={project.name}
        onDeleted={() => onDeleted(project.id)}
      />
      <EditProjectDialog
        projectId={project.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      {hasOpenedImport && (
        <Suspense fallback={null}>
          <ImportTasksDialog
            projectId={project.id}
            projectName={project.name}
            open={importOpen}
            onOpenChange={setImportOpen}
          />
        </Suspense>
      )}
      {hasOpenedExport && (
        <Suspense fallback={null}>
          <ExportTasksDialog
            projectId={project.id}
            projectName={project.name}
            open={exportOpen}
            onOpenChange={setExportOpen}
          />
        </Suspense>
      )}
    </SidebarMenuItem>
  );
}

export function NavProjects() {
  const navigate = useNavigate();
  const { t } = useTranslation("navigation");
  const { projectId: activeProjectId } = useParams({ strict: false });
  const projects = useLiveQuery(() => getProjects(), []);
  const statsByProject = useLiveQuery(() => getProjectsStats(db), []);
  const [groupOpen, setGroupOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  function handleDeletedProject(deletedId: string) {
    if (deletedId === activeProjectId) {
      void navigate({ to: "/" });
    }
  }

  return (
    <>
      <SidebarGroup className="min-h-0 flex-1 gap-1 p-3 pt-0">
        <div className="relative shrink-0">
          <SidebarGroupLabel
            className={cn(
              "flex h-7 cursor-pointer items-center justify-start gap-1 px-0 text-sidebar-accent-foreground",
            )}
            onClick={() => setGroupOpen((open) => !open)}
          >
            <span>{t("projects.label")}</span>
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "h-3.5 w-3.5 text-sidebar-foreground/60 transition-transform duration-200",
                groupOpen && "rotate-90",
              )}
            />
          </SidebarGroupLabel>
          <SidebarGroupAction
            className="top-2 right-2 text-sidebar-foreground/70"
            title={t("projects.add")}
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            <span className="sr-only">{t("projects.add")}</span>
          </SidebarGroupAction>
        </div>
        {groupOpen && (
          <SidebarGroupContent className="min-h-0 flex-1">
            <ScrollArea scrollFade>
              <SidebarMenu className="gap-0.5">
                {(projects ?? []).map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    stats={statsByProject?.get(project.id)}
                    isActive={activeProjectId === project.id}
                    onDeleted={handleDeletedProject}
                  />
                ))}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        )}
      </SidebarGroup>

      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}
