import type { StickyColorKey } from "@/lib/db/schema";

export const STICKY_COLORS_LIST: {
  key: StickyColorKey;
  label: string;
  backgroundColor: string;
}[] = [
  {
    key: "gray",
    label: "Gray",
    backgroundColor: "var(--editor-colors-gray-background)",
  },
  {
    key: "peach",
    label: "Peach",
    backgroundColor: "var(--editor-colors-peach-background)",
  },
  {
    key: "pink",
    label: "Pink",
    backgroundColor: "var(--editor-colors-pink-background)",
  },
  {
    key: "orange",
    label: "Orange",
    backgroundColor: "var(--editor-colors-orange-background)",
  },
  {
    key: "green",
    label: "Green",
    backgroundColor: "var(--editor-colors-green-background)",
  },
  {
    key: "light-blue",
    label: "Light blue",
    backgroundColor: "var(--editor-colors-light-blue-background)",
  },
  {
    key: "dark-blue",
    label: "Dark blue",
    backgroundColor: "var(--editor-colors-dark-blue-background)",
  },
  {
    key: "purple",
    label: "Purple",
    backgroundColor: "var(--editor-colors-purple-background)",
  },
];

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
