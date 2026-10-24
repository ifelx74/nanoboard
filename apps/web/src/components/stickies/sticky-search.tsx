import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function StickySearch({ value, onChange, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(containerRef, () => {
    if (value.trim() === "") {
      setIsOpen(false);
    }
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (value.trim() !== "") {
        onChange("");
      } else {
        setIsOpen(false);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("my-auto mr-2 flex items-center", className)}
    >
      {!isOpen && (
        <button
          type="button"
          aria-label="Search stickies"
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus({ preventScroll: true });
          }}
          className="-mr-2 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="size-4" />
        </button>
      )}

      <div
        className={cn(
          "flex w-0 items-center justify-start gap-1 overflow-hidden rounded-md border border-transparent opacity-0 transition-[width] ease-linear",
          isOpen &&
            "w-[7.5rem] border-border px-2.5 py-1.5 opacity-100 md:w-64",
        )}
      >
        <Search className="size-3.5 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search stickies"
          className="w-full max-w-[234px] border-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {isOpen && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onChange("");
              if (value.trim() === "") {
                setIsOpen(false);
              }
            }}
            className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}
