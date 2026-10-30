import { useLocation, useNavigate } from "@tanstack/react-router";
import { House, PencilRuler } from "lucide-react";
import type { ReactNode } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Stickies from "@/icons/stickies";

type NavButtonProps = {
  tooltip: string;
  isActive: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
};

function NavButton({ tooltip, isActive, onClick, icon, label }: NavButtonProps) {
  return (
    <SidebarMenuButton
      tooltip={tooltip}
      isActive={isActive}
      size="default"
      className="h-8 text-sm text-primary"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </SidebarMenuButton>
  );
}

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
            <NavButton
              tooltip="Home"
              isActive={pathname === "" || pathname === "/"}
              onClick={() => navigate({ to: "/" })}
              icon={<House aria-hidden="true" />}
              label="Home"
            />
            <NavButton
              tooltip="Stickies"
              isActive={pathname === "/stickies"}
              onClick={() => navigate({ to: "/stickies" })}
              icon={<Stickies className="shrink-0 size-4" aria-hidden="true" />}
              label="Stickies"
            />
            <NavButton
              tooltip="Whiteboard"
              isActive={pathname === "/whiteboard"}
              onClick={() => navigate({ to: "/whiteboard" })}
              icon={<PencilRuler aria-hidden="true" />}
              label="Whiteboard"
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
