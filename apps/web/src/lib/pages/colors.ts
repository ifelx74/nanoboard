/**
 * Plane's 8 semantic theme-adaptive editor color keys.
 * Matches `STICKY_COLORS` and the `--editor-colors-*-{text,background}` CSS
 * custom properties defined in `src/index.css`. Reused by inline color marks,
 * toolbar/bubble/slash pickers, and Callout background color pickers.
 */
export const PAGE_COLOR_KEYS = [
  "gray",
  "peach",
  "pink",
  "orange",
  "green",
  "light-blue",
  "dark-blue",
  "purple",
] as const;

export type PageColorKey = (typeof PAGE_COLOR_KEYS)[number];

export interface PageColorOption {
  readonly key: PageColorKey;
  readonly textVar: string;
  readonly backgroundVar: string;
}

export function getPageTextColorVar(key: PageColorKey): string {
  return `var(--editor-colors-${key}-text)`;
}

export function getPageBackgroundColorVar(key: PageColorKey): string {
  return `var(--editor-colors-${key}-background)`;
}

export const PAGE_COLORS: readonly PageColorOption[] = PAGE_COLOR_KEYS.map(
  (key) => ({
    key,
    textVar: getPageTextColorVar(key),
    backgroundVar: getPageBackgroundColorVar(key),
  }),
);

const PAGE_COLOR_KEY_SET: ReadonlySet<string> = new Set(PAGE_COLOR_KEYS);
const PAGE_COLOR_MAP: ReadonlyMap<PageColorKey, PageColorOption> = new Map(
  PAGE_COLORS.map((option) => [option.key, option]),
);

export function isPageColorKey(value: unknown): value is PageColorKey {
  return typeof value === "string" && PAGE_COLOR_KEY_SET.has(value);
}

export function getPageColor(
  key: string | null | undefined,
): PageColorOption | undefined {
  if (!isPageColorKey(key)) return undefined;
  return PAGE_COLOR_MAP.get(key);
}
