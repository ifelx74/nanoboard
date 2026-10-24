import { Check, ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BoardFilterSubject } from "./board-filter-model";
import { useToolbarShortcut } from "./use-toolbar-shortcut";
import type { BoardFilterSubjectDef } from "./use-board-filter-subjects";

function MenuRow({
  onClick,
  ariaLabel,
  ariaPressed,
  children,
}: {
  onClick: () => void;
  ariaLabel?: string;
  ariaPressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function SubjectPanel({
  subject,
  onBack,
}: {
  subject: BoardFilterSubjectDef;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to filters"
          className="flex min-w-0 items-center gap-1 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{subject.label}</span>
        </button>
        <div
          role="group"
          aria-label="Match operator"
          className="flex shrink-0 gap-1 pr-1"
        >
          {(
            [
              { value: false, label: "Is" },
              { value: true, label: "Is not" },
            ] as const
          ).map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={subject.negated === option.value}
              onClick={() => subject.onNegate(option.value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                subject.negated === option.value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="py-1">
        {subject.options.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No values yet
          </p>
        )}
        {subject.options.map((option) => {
          const selected = subject.selected.includes(option.value);
          return (
            <MenuRow
              key={option.value}
              ariaPressed={selected}
              onClick={() => subject.onToggle(option.value)}
            >
              <span className="flex w-3 shrink-0 justify-center">
                {selected && <Check className="h-3 w-3" aria-hidden="true" />}
              </span>
              {option.icon && (
                <span className="flex shrink-0 items-center [&_svg]:size-3.5">
                  {option.icon}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {option.count}
              </span>
            </MenuRow>
          );
        })}
      </div>
      {subject.selected.length > 0 && (
        <>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={subject.onClear}
            className="flex w-full items-center px-2 py-1.5 text-left text-xs text-muted-foreground outline-none hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}

export function BoardFilterMenu({
  subjects,
  activeCount,
}: {
  subjects: BoardFilterSubjectDef[];
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<BoardFilterSubject | null>(null);
  const subject = subjects.find((entry) => entry.id === subjectId) ?? null;
  const triggerLabel = `Filter by status, priority, labels, or due date${activeCount > 0 ? `, ${activeCount} active` : ""}`;

  useToolbarShortcut("f", () => setOpen((value) => !value));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSubjectId(null);
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={triggerLabel}
                    className={cn("relative", activeCount > 0 && "bg-accent")}
                  />
                }
              />
            }
          >
            <ListFilter />
            {activeCount > 0 && (
              <span className="-top-1 -right-1 absolute inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums">
                {activeCount}
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <span className="inline-flex items-center gap-1.5">
              Filter <Kbd>f</Kbd>
            </span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="start" className="w-60">
        {subject ? (
          <SubjectPanel subject={subject} onBack={() => setSubjectId(null)} />
        ) : (
          <div className="py-1">
            {subjects.map((entry) => (
              <MenuRow key={entry.id} onClick={() => setSubjectId(entry.id)}>
                <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-3.5">
                  {entry.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                {entry.selected.length > 0 && (
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {entry.selected.length}
                  </span>
                )}
                <ChevronRight
                  className="h-3 w-3 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </MenuRow>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
