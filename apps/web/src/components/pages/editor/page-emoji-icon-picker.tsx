import {
  lazy,
  Suspense,
  useState,
  type ReactElement,
  type SyntheticEvent,
} from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { PageLogo } from "@/lib/db/schema";
import type { EmojiIconPickerTab } from "./page-emoji-icon-picker-panel";

// Lazy-load the picker panel so emoji catalog lookup & 1,900+ entries never
// inflate non-picker chunks or mount DOM until a user opens the popover.
const PageEmojiIconPickerPanel = lazy(
  () => import("./page-emoji-icon-picker-panel"),
);

export interface PageEmojiIconPickerProps {
  value: PageLogo | null;
  onChange: (logo: PageLogo) => void;
  /** When supplied, renders a Remove button to clear the existing logo. */
  onRemove?: () => void;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: EmojiIconPickerTab;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  /** Interactive element passed to Base UI `PopoverTrigger`'s `render` prop. */
  trigger: ReactElement;
}

function PickerLoadingFallback() {
  return (
    <div className="flex w-[328px] max-w-[calc(100vw-2rem)] flex-col gap-2.5 p-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-sm" />
      </div>
      <Skeleton className="h-8 w-full rounded-md" />
      <div className="grid grid-cols-8 gap-1.5 pt-1">
        {Array.from({ length: 24 }, (_, idx) => (
          <Skeleton key={idx} className="size-8 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

/**
 * Reusable lazy-loaded Emoji + colored Lucide icon popover picker shared by
 * the Page Header Logo Picker and Callout blocks.
 */
export function PageEmojiIconPicker({
  value,
  onChange,
  onRemove,
  disabled = false,
  open,
  onOpenChange,
  defaultTab,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  trigger,
}: PageEmojiIconPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (disabled && nextOpen) return;
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  function handleSelect(logo: PageLogo) {
    onChange(logo);
    handleOpenChange(false);
  }

  function handleRemove() {
    onRemove?.();
    handleOpenChange(false);
  }

  const resolvedDefaultTab: EmojiIconPickerTab =
    defaultTab ?? (value?.type === "icon" ? "icon" : "emoji");

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger disabled={disabled} render={trigger} />
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="w-auto p-0"
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            handleOpenChange(false);
            return;
          }
          if (event.key !== "Tab") {
            event.stopPropagation();
          }
        }}
      >
        {isOpen && (
          <Suspense fallback={<PickerLoadingFallback />}>
            <PageEmojiIconPickerPanel
              value={value}
              defaultTab={resolvedDefaultTab}
              onSelect={handleSelect}
              onRemove={onRemove ? handleRemove : undefined}
            />
          </Suspense>
        )}
      </PopoverContent>
    </Popover>
  );
}
