import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface PopoverOption {
  key: string;
  label: React.ReactNode;
}

/**
 * Shared single-select popover shell behind the task property pickers.
 * The pick resolves true on success (popover closes) and false on
 * failure (stays open under the error toast).
 */
export default function TaskOptionPopover({
  options,
  selectedKey,
  onSelect,
  align = "start",
  children,
}: {
  options: PopoverOption[];
  selectedKey: string;
  onSelect: (key: string) => Promise<boolean>;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-0" align={align}>
        <div>
          {options.map((option) => (
            <Button
              key={option.key}
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 rounded-none px-2 first:rounded-t-md last:rounded-b-md"
              onClick={() => {
                void onSelect(option.key).then((ok) => {
                  if (ok) setOpen(false);
                });
              }}
            >
              {option.label}
              {selectedKey === option.key && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
