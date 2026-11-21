import type { PageLogo } from "@/lib/db/schema";
import { isProjectIconKey } from "@/lib/project-icons";
import { isPageColorKey, type PageColorKey } from "./colors";
import {
  DEFAULT_PAGE_ICON_COLOR,
  isValidEmojiValue,
  isValidHexColor,
  isValidPageLogo,
} from "./logo";

export const DEFAULT_CALLOUT_EMOJI = "💡";

export const DEFAULT_CALLOUT_LOGO: PageLogo = {
  type: "emoji",
  value: DEFAULT_CALLOUT_EMOJI,
};

export const CALLOUT_PREF_KEYS = {
  logo: "nanoboard:pages:calloutLogo",
  backgroundColor: "nanoboard:pages:calloutBackgroundColor",
} as const;

export interface CalloutPrefsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CalloutPrefs {
  logo: PageLogo;
  backgroundColor: PageColorKey | null;
}

/**
 * Persisted TipTap node attributes contract for `callout` nodes.
 * Shared across the Callout extension, `localStorage` defaults, demo seeding,
 * and Markdown export (Ticket 08).
 */
export interface CalloutNodeAttrs {
  logoType: "emoji" | "icon";
  emoji: string;
  iconName: string | null;
  iconColor: string | null;
  backgroundColor: PageColorKey | null;
}

function getDefaultStorage(): CalloutPrefsStorage | null {
  try {
    return typeof globalThis !== "undefined" && "localStorage" in globalThis
      ? globalThis.localStorage
      : null;
  } catch {
    return null;
  }
}

function parseStoredCalloutLogo(raw: string | null): PageLogo {
  if (!raw) return DEFAULT_CALLOUT_LOGO;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && isValidPageLogo(parsed)) {
      return parsed;
    }
    return DEFAULT_CALLOUT_LOGO;
  } catch {
    return DEFAULT_CALLOUT_LOGO;
  }
}

/**
 * Reads the user's last selected Callout logo and background color from
 * `localStorage`, validating both strictly and falling back to 💡 + `null`.
 */
export function readCalloutPrefs(
  storage: CalloutPrefsStorage | null = getDefaultStorage(),
): CalloutPrefs {
  if (!storage) {
    return {
      logo: DEFAULT_CALLOUT_LOGO,
      backgroundColor: null,
    };
  }

  try {
    const logo = parseStoredCalloutLogo(
      storage.getItem(CALLOUT_PREF_KEYS.logo),
    );
    const rawBg = storage.getItem(CALLOUT_PREF_KEYS.backgroundColor);
    const backgroundColor = isPageColorKey(rawBg) ? rawBg : null;
    return { logo, backgroundColor };
  } catch {
    return {
      logo: DEFAULT_CALLOUT_LOGO,
      backgroundColor: null,
    };
  }
}

/** Persists the user's chosen Callout logo for subsequent Callout inserts. */
export function writeCalloutLogoPref(
  logo: PageLogo,
  storage: CalloutPrefsStorage | null = getDefaultStorage(),
): void {
  if (!storage || !isValidPageLogo(logo)) return;
  try {
    storage.setItem(CALLOUT_PREF_KEYS.logo, JSON.stringify(logo));
  } catch {
    // Ignore storage access / quota errors in restricted browsing contexts.
  }
}

/**
 * Persists the user's chosen semantic Callout background color, or clears it
 * back to the default muted surface when `color` is `null`.
 */
export function writeCalloutBackgroundColorPref(
  color: PageColorKey | null,
  storage: CalloutPrefsStorage | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    if (color === null) {
      storage.removeItem(CALLOUT_PREF_KEYS.backgroundColor);
      return;
    }
    if (!isPageColorKey(color)) return;
    storage.setItem(CALLOUT_PREF_KEYS.backgroundColor, color);
  } catch {
    // Ignore storage access / quota errors in restricted browsing contexts.
  }
}

/** Converts a `PageLogo` into the logo fields of `CalloutNodeAttrs`. */
export function logoToCalloutAttrs(
  logo: PageLogo,
): Omit<CalloutNodeAttrs, "backgroundColor"> {
  if (logo.type === "icon") {
    return {
      logoType: "icon",
      emoji: DEFAULT_CALLOUT_EMOJI,
      iconName: logo.name,
      iconColor: logo.color,
    };
  }
  return {
    logoType: "emoji",
    emoji: logo.value,
    iconName: null,
    iconColor: null,
  };
}

/** Safely extracts a displayable `PageLogo` from Callout node attributes. */
export function calloutAttrsToLogo(attrs: Partial<CalloutNodeAttrs>): PageLogo {
  if (
    attrs.logoType === "icon" &&
    typeof attrs.iconName === "string" &&
    isProjectIconKey(attrs.iconName)
  ) {
    const color = isValidHexColor(attrs.iconColor)
      ? attrs.iconColor
      : DEFAULT_PAGE_ICON_COLOR;
    return {
      type: "icon",
      name: attrs.iconName,
      color,
    };
  }

  if (isValidEmojiValue(attrs.emoji)) {
    return {
      type: "emoji",
      value: attrs.emoji,
    };
  }

  return DEFAULT_CALLOUT_LOGO;
}

/** Builds initial `CalloutNodeAttrs` for inserting a new Callout block. */
export function buildInitialCalloutAttrs(
  storage: CalloutPrefsStorage | null = getDefaultStorage(),
): CalloutNodeAttrs {
  const { logo, backgroundColor } = readCalloutPrefs(storage);
  return {
    ...logoToCalloutAttrs(logo),
    backgroundColor,
  };
}
