import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PROJECT_ICONS, getProjectIcon } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

export default function ProjectIconPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const SelectedIcon = getProjectIcon(selected);
  const filteredIcons = Object.entries(PROJECT_ICONS).filter(([iconName]) =>
    iconName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="h-8 w-8 p-0"
          title="Pick an icon"
        >
          <SelectedIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons"
            className="h-8 text-xs"
          />
          <div className="max-h-[280px] overflow-y-auto pr-1">
            <div className="grid grid-cols-6 gap-1.5">
              {filteredIcons.map(([iconName, Icon]) => {
                const isSelected = selected === iconName;
                return (
                  <Button
                    key={iconName}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onSelect(iconName);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "h-10 items-center justify-center rounded-md p-0",
                      isSelected &&
                        "bg-sidebar-accent text-sidebar-accent-foreground",
                    )}
                    title={iconName}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
