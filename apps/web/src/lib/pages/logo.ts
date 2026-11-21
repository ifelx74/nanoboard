import type { PageLogo } from "@/lib/db/schema";
import { isProjectIconKey } from "@/lib/project-icons";

/** Plane's 8 preset icon colors for colored Lucide page & callout icons. */
export const PAGE_ICON_COLORS = [
  "#95999f",
  "#6d7b8a",
  "#5e6ad2",
  "#02b5ed",
  "#02b55c",
  "#f2be02",
  "#e57a00",
  "#f38e82",
] as const;

export const DEFAULT_PAGE_ICON_COLOR = "#6d7b8a";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_EMOJI_LENGTH = 32;
// Matches Unicode pictographs, regional indicator flags, and keycap sequences.
const EMOJI_GLYPH_PATTERN =
  /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3)/u;
// Rejects whitespace, control chars, ASCII letters, and HTML delimiters.
// eslint-disable-next-line no-control-regex
const DISALLOWED_EMOJI_CHAR_PATTERN = /[\s\u0000-\u001f\u007f<>a-zA-Z]/;

/** Returns true for strict `#RGB` or `#RRGGBB` CSS hex color strings. */
export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
}

/**
 * Validates a standalone Unicode emoji string (including ZWJ sequences,
 * skin-tone modifiers, flags, and keycaps) without importing the heavy emoji
 * lookup catalog into initial boot or data-layer bundles.
 */
export function isValidEmojiValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_EMOJI_LENGTH) return false;
  if (DISALLOWED_EMOJI_CHAR_PATTERN.test(value)) return false;
  return EMOJI_GLYPH_PATTERN.test(value);
}

/**
 * Validates that a value conforms to the `PageLogo | null` storage contract:
 * `null`, `{ type: "emoji", value }`, or `{ type: "icon", name, color }` where
 * `name` is a curated Lucide project icon and `color` is a valid hex color.
 */
export function isValidPageLogo(value: unknown): value is PageLogo | null {
  if (value === null) return true;
  if (typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  if (candidate.type === "emoji") {
    return isValidEmojiValue(candidate.value);
  }
  if (candidate.type === "icon") {
    return (
      typeof candidate.name === "string" &&
      isProjectIconKey(candidate.name) &&
      isValidHexColor(candidate.color)
    );
  }
  return false;
}

/**
 * Validates and returns a clean, normalized copy of a `PageLogo | null` payload
 * safe for persistence in IndexedDB. Throws on malformed inputs.
 */
export function normalizePageLogo(logo: PageLogo | null): PageLogo | null {
  if (logo === null) return null;
  if (typeof logo !== "object") {
    throw new Error("Invalid page logo.");
  }

  if (logo.type === "emoji") {
    const trimmed = typeof logo.value === "string" ? logo.value.trim() : "";
    if (!isValidEmojiValue(trimmed)) {
      throw new Error("Invalid page logo.");
    }
    return { type: "emoji", value: trimmed };
  }

  if (logo.type === "icon") {
    const name = typeof logo.name === "string" ? logo.name.trim() : "";
    const color = typeof logo.color === "string" ? logo.color.trim() : "";
    if (!isProjectIconKey(name) || !isValidHexColor(color)) {
      throw new Error("Invalid page logo.");
    }
    return { type: "icon", name, color };
  }

  throw new Error("Invalid page logo.");
}
