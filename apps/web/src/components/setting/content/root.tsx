import { Suspense } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SettingTab } from "@/constants/setting";
import { cn } from "@/lib/utils";
import { SETTING_PAGES_MAP } from "./pages";

type Props = {
  activeTab: SettingTab;
  className?: string;
};

export function SettingsContentRoot(props: Props) {
  const { activeTab, className } = props;
  const PageComponent = SETTING_PAGES_MAP[activeTab];

  return (
    <div
      className={cn("flex min-w-0 shrink flex-col overflow-hidden", className)}
    >
      <ScrollArea>
        <div className="px-8 py-9">
          <Suspense>
            <PageComponent />
          </Suspense>
        </div>
      </ScrollArea>
    </div>
  );
}
