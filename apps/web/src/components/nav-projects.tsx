import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  Folder,
  List,
  SquareKanban,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { getProjects } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

const projectViews = [
  {
    key: "board",
    title: "Board",
    icon: SquareKanban,
    to: "/project/$projectId/board" as const,
  },
  {
    key: "calendar",
    title: "Calendar",
    icon: CalendarDays,
    to: "/project/$projectId/calendar" as const,
  },
  {
    key: "list",
    title: "List",
    icon: List,
    to: "/project/$projectId/list" as const,
  },
];

export function NavProjects() {
  const navigate = useNavigate();
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });
  const { projectId: activeProjectId } = useParams({ strict: false });
  const projects = useLiveQuery(() => getProjects(), []);
  const [expandedIds, setExpandedIds] = useState<string[]>(
    activeProjectId ? [activeProjectId] : [],
  );

  useEffect(() => {
    if (
      !activeProjectId &&
      expandedIds.length === 0 &&
      projects &&
      projects.length > 0
    ) {
      const first = projects[0];
      if (first) setExpandedIds([first.id]);
    }
  }, [activeProjectId, expandedIds.length, projects]);

  function toggleProject(id: string) {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <SidebarGroup className="gap-1 p-2">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {(projects ?? []).map((project) => {
            const expanded = expandedIds.includes(project.id);
            const isActiveProject = activeProjectId === project.id;
            return (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton
                  tooltip={project.name}
                  isActive={isActiveProject && expanded}
                  size="default"
                  className="h-8 text-sm"
                  onClick={() => toggleProject(project.id)}
                >
                  <Folder aria-hidden="true" />
                  <span>{project.name}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      "ml-auto size-4 transition-transform",
                      expanded && "rotate-90",
                    )}
                  />
                </SidebarMenuButton>
                {expanded && (
                  <SidebarMenuSub>
                    {projectViews.map((view) => (
                      <SidebarMenuSubItem key={view.key}>
                        <SidebarMenuSubButton
                          isActive={
                            isActiveProject &&
                            pathname.endsWith(`/${view.key}`)
                          }
                          className="cursor-pointer"
                          onClick={() =>
                            navigate({
                              to: view.to,
                              params: { projectId: project.id },
                            })
                          }
                        >
                          <view.icon aria-hidden="true" />
                          <span>{view.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
