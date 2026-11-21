import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { i18n } from "@/lib/i18n";
import {
  PAGE_COLORS,
  getPageColor,
  type PageColorKey,
} from "@/lib/pages/colors";
import { cn } from "@/lib/utils";

/**
 * Static localized label lookup for Plane's 8 semantic editor colors.
 * Uses literal translation keys so static i18n usage analysis stays exact.
 */
export function getPageColorLabel(key: PageColorKey): string {
  switch (key) {
    case "gray":
      return i18n.t("pages:editor.colors.gray");
    case "peach":
      return i18n.t("pages:editor.colors.peach");
    case "pink":
      return i18n.t("pages:editor.colors.pink");
    case "orange":
      return i18n.t("pages:editor.colors.orange");
    case "green":
      return i18n.t("pages:editor.colors.green");
    case "light-blue":
      return i18n.t("pages:editor.colors.lightBlue");
    case "dark-blue":
      return i18n.t("pages:editor.colors.darkBlue");
    case "purple":
      return i18n.t("pages:editor.colors.purple");
  }
}

export function PageColorTriggerPreview({
  activeTextColor,
  activeBackgroundColor,
  className,
}: {
  activeTextColor?: PageColorKey;
  activeBackgroundColor?: PageColorKey;
  className?: string;
}) {
  const textOption = getPageColor(activeTextColor);
  const bgOption = getPageColor(activeBackgroundColor);

  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-sm border border-border text-[11px] leading-none font-semibold",
        !bgOption && "bg-background",
        className,
      )}
      style={bgOption ? { backgroundColor: bgOption.backgroundVar } : undefined}
      aria-hidden="true"
    >
      <span
        className={cn(!textOption && "text-foreground")}
        style={textOption ? { color: textOption.textVar } : undefined}
      >
        A
      </span>
    </span>
  );
}

export interface PageColorPickerPanelProps {
  activeTextColor?: PageColorKey;
  activeBackgroundColor?: PageColorKey;
  onSelectTextColor: (color: PageColorKey | undefined) => void;
  onSelectBackgroundColor: (color: PageColorKey | undefined) => void;
}

/**
 * Plane's two-row semantic color palette popover body (`Text colors` +
 * `Background colors`), shared across Sticky Toolbar and Bubble Menu.
 */
export function PageColorPickerPanel({
  activeTextColor,
  activeBackgroundColor,
  onSelectTextColor,
  onSelectBackgroundColor,
}: PageColorPickerPanelProps) {
  const { t } = useTranslation("pages");

  return (
    <div className="space-y-2.5 p-2">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {t("editor.colors.textColors")}
        </p>
        <div className="flex items-center gap-1.5">
          {PAGE_COLORS.map((color) => {
            const label = getPageColorLabel(color.key);
            const active = activeTextColor === color.key;
            return (
              <button
                key={color.key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelectTextColor(color.key)}
                className={cn(
                  "size-6 shrink-0 cursor-pointer rounded-sm border border-border/80 transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active &&
                    "ring-2 ring-brand-800 ring-offset-1 ring-offset-popover",
                )}
                style={{ backgroundColor: color.textVar }}
              />
            );
          })}
          <button
            type="button"
            title={t("editor.colors.resetText")}
            aria-label={t("editor.colors.resetText")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelectTextColor(undefined)}
            className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Ban className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {t("editor.colors.backgroundColors")}
        </p>
        <div className="flex items-center gap-1.5">
          {PAGE_COLORS.map((color) => {
            const label = getPageColorLabel(color.key);
            const active = activeBackgroundColor === color.key;
            return (
              <button
                key={color.key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelectBackgroundColor(color.key)}
                className={cn(
                  "size-6 shrink-0 cursor-pointer rounded-sm border border-border/80 transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active &&
                    "ring-2 ring-brand-800 ring-offset-1 ring-offset-popover",
                )}
                style={{ backgroundColor: color.backgroundVar }}
              />
            );
          })}
          <button
            type="button"
            title={t("editor.colors.resetBackground")}
            aria-label={t("editor.colors.resetBackground")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelectBackgroundColor(undefined)}
            className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Ban className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
