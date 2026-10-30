import { useLocation, useNavigate } from "@tanstack/react-router";
import { House, PencilRuler } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Stickies from "@/icons/stickies";

export function NavMain() {
  const navigate = useNavigate();
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });

  return (
    <SidebarGroup className="gap-1 p-2">
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Home"
              isActive={pathname === "" || pathname === "/"}
              size="default"
              className="h-8 text-sm text-primary"
              onClick={() => navigate({ to: "/" })}
            >
              <House aria-hidden="true" />
              <span>Home</span>
            </SidebarMenuButton>
            <SidebarMenuButton
              tooltip="Stickies"
              isActive={pathname === "/stickies"}
              size="default"
              className="h-8 text-sm text-primary"
              onClick={() => navigate({ to: "/stickies" })}
            >
              <Stickies className="shrink-0 size-4" aria-hidden="true" />
              <span>Stickies</span>
            </SidebarMenuButton>
            <SidebarMenuButton
              tooltip="Whiteboard"
              isActive={pathname === "/whiteboard"}
              size="default"
              className="h-8 text-sm text-primary"
              onClick={() => navigate({ to: "/whiteboard" })}
            >
              <PencilRuler aria-hidden="true" />
              <span>Whiteboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
