/**
 * The nine palette colors, verbatim from Kaneo (`label-colors.ts` there).
 * Single-sourced here: Kaneo duplicates this list inside its labels popover.
 * Display names are Kaneo's own English labels; this app has no i18n.
 */
export const LABEL_COLORS = [
  { value: "gray", label: "Stone", color: "var(--color-stone-500)" },
  { value: "dark-gray", label: "Slate", color: "var(--color-slate-500)" },
  { value: "purple", label: "Lavender", color: "var(--color-violet-500)" },
  { value: "teal", label: "Sage", color: "var(--color-emerald-600)" },
  { value: "green", label: "Forest", color: "var(--color-green-600)" },
  { value: "yellow", label: "Amber", color: "var(--color-amber-600)" },
  { value: "orange", label: "Terracotta", color: "var(--color-orange-600)" },
  { value: "pink", label: "Rose", color: "var(--color-rose-600)" },
  { value: "red", label: "Crimson", color: "var(--color-red-600)" },
] as const;

export type LabelColorValue = (typeof LABEL_COLORS)[number]["value"];

const FALLBACK_LABEL_COLOR = "var(--color-neutral-400)";
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

/** Port of Kaneo's `resolveLabelColor`: palette value, hex, CSS color, fallback. */
export function resolveLabelColor(value: string): string {
  const mapped = LABEL_COLORS.find((color) => color.value === value)?.color;
  if (mapped) return mapped;

  if (HEX_COLOR.test(value)) return value;

  if (typeof CSS !== "undefined" && CSS.supports?.("color", value)) {
    return value;
  }

  return FALLBACK_LABEL_COLOR;
}

export { FALLBACK_LABEL_COLOR };
