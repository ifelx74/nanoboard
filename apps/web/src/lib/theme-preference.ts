/**
 * Pure theme-preference logic (parse / toggle / stored-envelope resolve), kept
 * DOM-free so the plain Node harness covers it directly. Storage effects and
 * root-class application live in `store/theme.ts`; the pre-paint script in
 * `index.html` duplicates the envelope parsing in miniature because it runs
 * before the bundle loads and cannot import from it.
 */

/** The only two theme values the app offers. Fresh users get light. */
export type Theme = "light" | "dark";

/** zustand persist storage key for the theme store envelope. */
export const THEME_STORAGE_KEY = "nanoboard-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Allow-list parse: exactly light or dark, everything else fails closed to light. */
export function parseTheme(value: unknown): Theme {
  return isTheme(value) ? value : "light";
}

/** Binary flip between the two known values. */
export function toggleTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * Resolve the raw string from storage to the theme to apply. Understands the
 * zustand persist envelope (`{"state":{"theme":...},"version":...}`) — not a
 * bare-string comparison — and fails closed to light on missing, corrupt, or
 * foreign values so bad data can never leave the app classless or broken.
 */
export function resolveStoredTheme(raw: string | null | undefined): Theme {
  if (typeof raw !== "string" || raw === "") return "light";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return "light";
    const state = (parsed as { state?: unknown }).state;
    if (typeof state !== "object" || state === null) return "light";
    return parseTheme((state as { theme?: unknown }).theme);
  } catch {
    return "light";
  }
}
