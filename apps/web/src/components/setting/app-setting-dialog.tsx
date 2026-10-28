import { useState } from "react";
import type { SettingTab } from "@/constants/setting";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { SettingsContentRoot } from "./content/root";
import { SettingsSidebarRoot } from "./sidebar/root";

export default function AppSettingDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingTab>("preferences");

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={
          "max-h-[calc(100dvh-10rem)] max-w-[calc(100vw-2rem)] flex-col overflow-clip rounded-xl border-sm border-subtle shadow-raised-300 origin-(--transform-origin) transition-[opacity,transform] duration-200 motion-reduce:transition-none w-250 h-175 min-h-0"
        }
        bottomStickOnMobile={false}
      >
        <div className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </div>
        <div className="@container flex min-h-0 flex-1">
          <SettingsSidebarRoot
            activeTab={activeTab}
            updateActiveTab={setActiveTab}
            className="w-14 rounded-l-xl border-r border-border sm:w-56"
          />
          <SettingsContentRoot
            activeTab={activeTab}
            className="flex-1 rounded-r-xl"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
