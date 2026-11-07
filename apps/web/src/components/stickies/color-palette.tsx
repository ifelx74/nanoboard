import { useTranslation } from "react-i18next";
import { STICKY_COLORS, type StickyColorKey } from "@/lib/db/schema";

/**
 * Background for every color key. Typing it as a `Record` over
 * `StickyColorKey` keeps it in lock-step with `STICKY_COLORS` in the schema:
 * adding a key there is a compile error here until the entry exists. Color
 * names are translated in the component (see `ColorPalette`), not here.
 */
const STICKY_COLOR_BACKGROUNDS: Record<StickyColorKey, string> = {
  gray: "var(--editor-colors-gray-background)",
  peach: "var(--editor-colors-peach-background)",
  pink: "var(--editor-colors-pink-background)",
  orange: "var(--editor-colors-orange-background)",
  green: "var(--editor-colors-green-background)",
  "light-blue": "var(--editor-colors-light-blue-background)",
  "dark-blue": "var(--editor-colors-dark-blue-background)",
  purple: "var(--editor-colors-purple-background)",
};

const STICKY_COLORS_LIST = STICKY_COLORS.map((key) => ({
  key,
  backgroundColor: STICKY_COLOR_BACKGROUNDS[key],
}));

export function stickyBackgroundColor(key: StickyColorKey): string {
  return STICKY_COLOR_BACKGROUNDS[key] ?? STICKY_COLORS_LIST[0].backgroundColor;
}

type Props = {
  selectedColor?: StickyColorKey;
  onSelectColor: (color: StickyColorKey) => void;
};

export function ColorPalette({ selectedColor, onSelectColor }: Props) {
  const { t } = useTranslation("stickies");
  const colorLabels: Record<StickyColorKey, string> = {
    gray: t("colors.gray"),
    peach: t("colors.peach"),
    pink: t("colors.pink"),
    orange: t("colors.orange"),
    green: t("colors.green"),
    "light-blue": t("colors.lightBlue"),
    "dark-blue": t("colors.darkBlue"),
    purple: t("colors.purple"),
  };
  return (
    <div className="shadow-lg absolute bottom-5 left-0 z-20 mb-2 w-56 rounded-md border border-border bg-card p-2">
      <div className="mb-2 text-[13px] font-semibold text-muted-foreground">
        {t("colors.heading")}
      </div>
      <div className="flex flex-wrap gap-2">
        {STICKY_COLORS_LIST.map((color) => {
          const isSelected = selectedColor === color.key;
          return (
            <button
              key={color.key}
              type="button"
              aria-label={colorLabels[color.key]}
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
