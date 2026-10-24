import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { PreferencesSettings } from "./preferences/preferences-settings";

type Props = {
  className?: string;
};

export const SettingsContent = (props: Props) => {
  const { className } = props;

  return (
    <div className={cn("flex shrink-0 flex-col overflow-hidden", className)}>
      <ScrollArea>
        <div className="px-8 py-9">
          <PreferencesSettings />
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
};
