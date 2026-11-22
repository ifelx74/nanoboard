import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PagesSearchInputProps = {
  value: string;
  onChange: (nextValue: string) => void;
};

/**
 * Plane-style expandable search control for the Pages list toolbar.
 * Expands smoothly when activated; Escape clears non-empty input first and
 * collapses on empty input; clicking outside collapses when empty.
 */
export function PagesSearchInput({ value, onChange }: PagesSearchInputProps) {
  const { t } = useTranslation("pages");
  const [isOpen, setIsOpen] = useState(value.length > 0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const expanded = isOpen || value.length > 0;

  useEffect(() => {
    if (!expanded) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        value.trim().length === 0
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expanded, value]);

  function openAndFocus() {
    setIsOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleClearAndCollapse() {
    onChange("");
    setIsOpen(false);
    inputRef.current?.blur();
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("list.search.open")}
        onClick={openAndFocus}
        className="size-7 text-muted-foreground hover:text-foreground"
      >
        <Search className="size-3.5" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-7 w-44 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[13px] transition-[width] duration-200 focus-within:border-ring sm:w-64",
      )}
    >
      <Search
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          if (value.length > 0) {
            onChange("");
          } else {
            setIsOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={t("list.search.placeholder")}
        aria-label={t("list.search.placeholder")}
        className="w-full min-w-0 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        aria-label={t("list.search.clear")}
        onClick={handleClearAndCollapse}
        className="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-xs text-muted-foreground hover:text-foreground"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}
