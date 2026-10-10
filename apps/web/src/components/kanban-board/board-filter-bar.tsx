import { useLiveQuery } from "dexie-react-hooks";
import { Check, Filter } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getProjectLabels } from "@/lib/db/queries";
import { resolveLabelColor } from "@/lib/label-color";
import { cn } from "@/lib/utils";

export default function BoardFilterBar({
  projectId,
  selected,
  onToggle,
  onClear,
}: {
  projectId: string;
  selected: string[] | null;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const palette = useLiveQuery(() => getProjectLabels(projectId), [projectId]);
  const activeCount = selected?.length ?? 0;

  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pt-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Filter by labels${activeCount > 0 ? `, ${activeCount} active` : ""}`}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none hover:bg-accent/60",
              activeCount > 0 && "border-ring/50 bg-accent",
            )}
          >
            <Filter className="h-3 w-3" aria-hidden="true" />
            Filter
            {activeCount > 0 && (
              <span className="tabular-nums text-muted-foreground">
                {activeCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <div className="border-b border-border px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Filter by labels
          </div>
          <div className="py-1">
            {(palette ?? []).map((label) => (
              <button
                key={label.id}
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent/50"
                onClick={() => onToggle(label.id)}
              >
                <span className="flex w-3 shrink-0 justify-center">
                  {selected?.includes(label.id) && (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: resolveLabelColor(label.color),
                  }}
                />
                <span className="truncate">{label.name}</span>
              </button>
            ))}
            {(palette ?? []).length === 0 && (
              <span className="px-2 text-xs text-muted-foreground">
                No labels in this project yet
              </span>
            )}
            {activeCount > 0 && (
              <>
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  className="flex w-full items-center px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  onClick={() => {
                    onClear();
                    setOpen(false);
                  }}
                >
                  Clear filter
                </button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
