import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  isActive: boolean;
  label: string;
  onClick: () => void;
};

export function SettingsSidebarItem(props: Props) {
  const { icon: Icon, isActive, label, onClick } = props;

  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      title={label}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors sm:justify-start",
        isActive
          ? "bg-secondary font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={onClick}
    >
      <span className="grid size-4 shrink-0 place-items-center">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="hidden truncate sm:inline">{label}</span>
    </button>
  );
}
