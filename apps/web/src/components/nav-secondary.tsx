import { Settings } from "lucide-react";
import { useState } from "react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import AppSettingDialog from "./setting/app-setting-dialog";

export function NavSecondary() {
  const [isSettingOpen, setSettingOpen] = useState(false);

  return (
    <>
      <SidebarMenu className="gap-0.5">
        <SidebarMenuItem>
          <SidebarMenuButton
            size="default"
            className="h-8 text-sm"
            onClick={() => setSettingOpen(true)}
          >
            <Settings aria-hidden="true" />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <AppSettingDialog
        open={isSettingOpen}
        onClose={() => setSettingOpen(false)}
      />
    </>
  );
}
