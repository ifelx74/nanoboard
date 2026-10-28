import { ScrollArea } from "@/components/ui/scroll-area";
import type { SettingTab } from "@/constants/setting";
import { cn } from "@/lib/utils";
import { SettingsSidebarHeader } from "./header";
import { SettingsSidebarItemCategories } from "./item-categories";

type Props = {
  activeTab: SettingTab;
  className?: string;
  updateActiveTab: (tab: SettingTab) => void;
};

export function SettingsSidebarRoot(props: Props) {
  const { activeTab, className, updateActiveTab } = props;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden bg-muted/40 px-2 py-3",
        className,
      )}
    >
      <ScrollArea>
        <SettingsSidebarHeader />
        <SettingsSidebarItemCategories
          activeTab={activeTab}
          updateActiveTab={updateActiveTab}
        />
      </ScrollArea>
    </div>
  );
}
