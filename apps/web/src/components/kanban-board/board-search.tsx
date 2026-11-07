import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToolbarShortcut } from "./use-toolbar-shortcut";

export function BoardSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation("board");
  const [forceOpen, setForceOpen] = useState(false);
  const expanded = forceOpen || value !== "";

  const focusSearch = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  useToolbarShortcut("/", () => {
    setForceOpen(true);
    // The field mounts on open; focusing here covers the already-mounted
    // case, the effect below covers the fresh mount.
    focusSearch();
  });

  useEffect(() => {
    if (forceOpen) focusSearch();
  }, [forceOpen]);

  if (!expanded) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("search.label")}
              onClick={() => setForceOpen(true)}
            >
              <Search />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span className="inline-flex items-center gap-1.5">
              {t("search.label")} <Kbd>/</Kbd>
            </span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("relative items-center", "flex w-44 sm:w-56")}>
      <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        maxLength={256}
        aria-label={t("search.inputLabel")}
        placeholder={t("search.placeholder")}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setForceOpen(false)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (value) {
            onChange("");
          } else {
            event.currentTarget.blur();
          }
        }}
        className="[&_[data-slot=input]]:h-7 [&_[data-slot=input]]:pr-7 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-[13px] [&_[data-slot=input]]:leading-7"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("search.clearLabel")}
          // Keep focus in the field so the click reliably fires and the
          // cleared field stays expanded, matching Esc-clear.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange("")}
          className="-translate-y-1/2 absolute top-1/2 right-0.5 sm:size-6"
        >
          <X />
        </Button>
      )}
    </div>
  );
}
