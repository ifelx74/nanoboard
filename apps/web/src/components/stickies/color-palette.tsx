import { STICKY_COLORS, type StickyColorKey } from "@/lib/db/schema";

/**
 * Display data for every color key. Typing it as a `Record` over
 * `StickyColorKey` keeps it in lock-step with `STICKY_COLORS` in the schema:
 * adding a key there is a compile error here until the entry exists.
 */
const STICKY_COLOR_RECORD: Record<
  StickyColorKey,
  { label: string; backgroundColor: string }
> = {
  gray: {
    label: "Gray",
    backgroundColor: "var(--editor-colors-gray-background)",
  },
  peach: {
    label: "Peach",
    backgroundColor: "var(--editor-colors-peach-background)",
  },
  pink: {
    label: "Pink",
    backgroundColor: "var(--editor-colors-pink-background)",
  },
  orange: {
    label: "Orange",
    backgroundColor: "var(--editor-colors-orange-background)",
  },
  green: {
    label: "Green",
    backgroundColor: "var(--editor-colors-green-background)",
  },
  "light-blue": {
    label: "Light blue",
    backgroundColor: "var(--editor-colors-light-blue-background)",
  },
  "dark-blue": {
    label: "Dark blue",
    backgroundColor: "var(--editor-colors-dark-blue-background)",
  },
  purple: {
    label: "Purple",
    backgroundColor: "var(--editor-colors-purple-background)",
  },
};

const STICKY_COLORS_LIST = STICKY_COLORS.map((key) => ({
  key,
  ...STICKY_COLOR_RECORD[key],
}));

export function stickyBackgroundColor(key: StickyColorKey): string {
  return (
    STICKY_COLOR_RECORD[key]?.backgroundColor ??
    STICKY_COLORS_LIST[0].backgroundColor
  );
}

type Props = {
  selectedColor?: StickyColorKey;
  onSelectColor: (color: StickyColorKey) => void;
};

export function ColorPalette({ selectedColor, onSelectColor }: Props) {
  return (
    <div className="shadow-lg absolute bottom-5 left-0 z-20 mb-2 w-56 rounded-md border border-border bg-card p-2">
      <div className="mb-2 text-[13px] font-semibold text-muted-foreground">
        Background colors
      </div>
      <div className="flex flex-wrap gap-2">
        {STICKY_COLORS_LIST.map((color) => {
          const isSelected = selectedColor === color.key;
          return (
            <button
              key={color.key}
              type="button"
              aria-label={color.label}
              // Suppress mousedown so picking a swatch keeps the editor
              // focused (the palette opens from the note's toolbar).
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelectColor(color.key)}
              className={`h-6 w-6 cursor-pointer rounded-md transition-all hover:ring-2 hover:ring-primary focus:ring-2 focus:ring-primary focus:outline-none ${
                isSelected ? "ring-2 ring-primary" : ""
              }`}
              style={{
                backgroundColor: color.backgroundColor,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
