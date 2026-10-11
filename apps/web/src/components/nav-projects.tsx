import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ChevronRight,
  Folder,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import CreateProjectDialog from "@/components/project/create-project-dialog";
import ProjectDeleteDialog from "@/components/project/project-delete-dialog";
import { ProjectProgress } from "@/components/project/project-progress";
import { getProjectStats, getProjects } from "@/lib/db/queries";
import type { Project } from "@/lib/db/schema";
import { getProjectIcon } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

function ProjectRow({
  project,
  isActive,
  onDeleted,
}: {
  project: Project;
  isActive: boolean;
  onDeleted: (projectId: string) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const stats = useLiveQuery(() => getProjectStats(project.id), [project.id]);
  const ProjectIcon = getProjectIcon(project.icon);

  function openBoard() {
    void navigate({
      to: "/project/$projectId/board",
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
          className="text-muted-foreground max-md:hidden group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0 group-has-data-[state=open]/menu-item:opacity-0"
        />
      </SidebarMenuButton>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`More actions for ${project.name}`}
            className="absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-lg p-0 text-sidebar-foreground ring-sidebar-ring transition-transform outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground data-[state=open]:opacity-100 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 md:opacity-0"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="start" side="right">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              openBoard();
            }}
            className="flex h-7 w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50"
          >
            <Folder className="size-4 shrink-0 text-muted-foreground" />
            <span>View project</span>
          </button>
          <button
            type="button"
            onClick={handleDeleteRequest}
            className="flex h-7 w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-accent/50"
          >
            <Trash2 className="size-4 shrink-0" />
            <span>Delete project</span>
          </button>
        </PopoverContent>
      </Popover>

      <ProjectDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectId={project.id}
        projectName={project.name}
        onDeleted={() => onDeleted(project.id)}
      />
    </SidebarMenuItem>
  );
}

/**
 * Kaneo's project list, mapped: flat rows into the board, per-project
 * icons, progress wedge, hover menu (view/share/delete), Plus to create.
 * Deliberately absent: project settings (no settings page), drag reorder
 * (seam ready, UI follow-up), and the server-only nav items.
 */
export function NavProjects() {
  const navigate = useNavigate();
  const { projectId: activeProjectId } = useParams({ strict: false });
  const projects = useLiveQuery(() => getProjects(), []);
  const [groupOpen, setGroupOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  function handleDeletedProject(deletedId: string) {
    if (deletedId === activeProjectId) {
      void navigate({ to: "/" });
    }
  }

  return (
    <>
      <SidebarGroup className="gap-1 p-2 pt-1">
        <div className="relative">
          <SidebarGroupLabel
            className={cn(
              "flex h-7 cursor-pointer items-center justify-start gap-1 px-0 text-sidebar-accent-foreground",
            )}
            onClick={() => setGroupOpen((open) => !open)}
          >
            <span>Projects</span>
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
            title="Add project"
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            <span className="sr-only">Add project</span>
          </SidebarGroupAction>
        </div>
        {groupOpen && (
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {(projects ?? []).map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  isActive={activeProjectId === project.id}
                  onDeleted={handleDeletedProject}
                />
              ))}
            </SidebarMenu>
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
