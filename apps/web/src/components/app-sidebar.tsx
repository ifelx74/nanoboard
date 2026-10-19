import type * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { ThemeSwitch } from "@/components/theme-switch";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { NavSecondary } from "./nav-secondary";
import { BackgroundLogo } from "./common/logo";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible="offcanvas"
      variant="inset"
      className="border-none"
      {...props}
    >
      <SidebarHeader className="pt-1 pb-1.5">
        <span className="flex h-8 items-center px-2 font-heading text-primary text-lg font-semibold tracking-tight gap-2">
          <BackgroundLogo /> Nanoboard
        </span>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden gap-1 py-1">
        <NavMain />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter>
        <NavSecondary />
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">v0.0.0</span>
          <ThemeSwitch />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
