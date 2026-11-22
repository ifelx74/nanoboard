import {
  emojis as tiptapEmojis,
  type EmojiItem,
} from "@tiptap/extension-emoji";
import { isValidEmojiValue } from "./logo";

/**
 * Lazy-chunk-only module-level singleton emoji dataset.
 * Never import this file from initial boot routes, `src/lib/db/pages.ts`, or
 * `PageLogoIcon` — keep it strictly inside the lazy Pages editor/picker chunk.
 */

export const EMOJI_CATEGORIES = [
  "smileys",
  "people",
  "nature",
  "food",
  "travel",
  "activities",
  "objects",
  "symbols",
  "flags",
] as const;

export type EmojiCategoryKey = (typeof EMOJI_CATEGORIES)[number];

export interface LocalEmojiItem extends EmojiItem {
  readonly name: string;
  readonly emoji: string;
  readonly shortcodes: string[];
  readonly tags: string[];
  readonly group: EmojiCategoryKey;
  readonly emoticons: string[];
  readonly version?: number;
}

export interface LocalEmojiGroup {
  readonly key: EmojiCategoryKey;
  readonly items: readonly LocalEmojiItem[];
}

const RAW_GROUP_TO_CATEGORY: Readonly<Record<string, EmojiCategoryKey>> = {
  "": "smileys",
  "people & body": "people",
  "animals & nature": "nature",
  "food & drink": "food",
  "travel & places": "travel",
  activities: "activities",
  objects: "objects",
  symbols: "symbols",
  flags: "flags",
};

interface IndexedEmoji {
  readonly item: LocalEmojiItem;
  readonly lowerName: string;
  readonly lowerShortcodes: readonly string[];
  readonly lowerTags: readonly string[];
}

function buildCatalog() {
  const list: LocalEmojiItem[] = [];
  const indexed: IndexedEmoji[] = [];
  const buckets = new Map<EmojiCategoryKey, LocalEmojiItem[]>(
    EMOJI_CATEGORIES.map((category) => [category, []]),
  );
  const shortcodeMap = new Map<string, string>();
  const byName = new Map<string, LocalEmojiItem>();

  for (const raw of tiptapEmojis) {
    if (!raw.emoji || !isValidEmojiValue(raw.emoji)) continue;
    if (raw.group === "components") continue;
    if (raw.name.startsWith("regional_indicator_")) continue;

    const category = RAW_GROUP_TO_CATEGORY[raw.group ?? ""];
    if (!category) continue;

    // Deliberately omit `fallbackImage` so `@tiptap/extension-emoji` stays
    // strictly local-first and never issues external CDN image requests.
    const item: LocalEmojiItem = {
      name: raw.name,
      emoji: raw.emoji,
      shortcodes: [...raw.shortcodes],
      tags: [...raw.tags],
      group: category,
      emoticons: raw.emoticons ? [...raw.emoticons] : [],
      ...(raw.version !== undefined ? { version: raw.version } : {}),
    };

    list.push(item);
    buckets.get(category)?.push(item);

    const lowerName = item.name.toLowerCase();
    const lowerShortcodes = item.shortcodes.map((code) => code.toLowerCase());
    const lowerTags = item.tags.map((tag) => tag.toLowerCase());

    indexed.push({
      item,
      lowerName,
      lowerShortcodes,
      lowerTags,
    });

    byName.set(lowerName, item);
    if (!shortcodeMap.has(lowerName)) {
      shortcodeMap.set(lowerName, item.emoji);
    }
    for (const code of lowerShortcodes) {
      if (!shortcodeMap.has(code)) {
        shortcodeMap.set(code, item.emoji);
      }
      if (!byName.has(code)) {
        byName.set(code, item);
      }
    }
  }

  const groups: LocalEmojiGroup[] = EMOJI_CATEGORIES.map((key) => ({
    key,
    items: buckets.get(key) ?? [],
  }));

  const popularSeeds = [
    "bulb",
    "rocket",
    "fire",
    "white_check_mark",
    "tada",
    "sparkles",
    "grinning",
    "heart",
    "star",
    "pushpin",
    "warning",
    "memo",
    "brain",
    "dart",
    "zap",
    "hammer_and_wrench",
    "package",
    "lock",
    "date",
    "speech_balloon",
    "+1",
    "eyes",
  ];

  const popular: LocalEmojiItem[] = [];
  const seenPopular = new Set<string>();
  for (const seed of popularSeeds) {
    const found = byName.get(seed);
    if (found && !seenPopular.has(found.name)) {
      seenPopular.add(found.name);
      popular.push(found);
    }
  }

  return {
    list,
    indexed,
    groups,
    shortcodeMap,
    popular,
  };
}

const CATALOG = buildCatalog();

/** Flat array of local Unicode emojis (zero CDN fallback URLs). */
export const LOCAL_PAGE_EMOJIS: readonly LocalEmojiItem[] = CATALOG.list;

/** Pre-grouped emojis by picker category, initialized once at module load. */
export const LOCAL_EMOJI_GROUPS: readonly LocalEmojiGroup[] = CATALOG.groups;

/** Curated default suggestions when `/emoji` opens with an empty query. */
export const POPULAR_EMOJIS: readonly LocalEmojiItem[] = CATALOG.popular;

/** O(1) lookup from emoji canonical name or shortcode alias to Unicode char. */
export function resolveEmojiCharByName(name: string): string | undefined {
  return CATALOG.shortcodeMap.get(name.toLowerCase());
}

/**
 * Searches local Unicode emojis across name, shortcodes, and tags with ranked
 * relevance (exact -> prefix -> substring -> tag). Returns `POPULAR_EMOJIS`
 * when query is empty.
 */
export function searchLocalEmojis(query: string, limit = 48): LocalEmojiItem[] {
  const normalized = query
    .trim()
    .replace(/^:+|:+$/g, "")
    .toLowerCase();
  if (!normalized) {
    return POPULAR_EMOJIS.slice(0, limit);
  }

  const exact: LocalEmojiItem[] = [];
  const prefix: LocalEmojiItem[] = [];
  const substring: LocalEmojiItem[] = [];
  const tagMatch: LocalEmojiItem[] = [];

  for (const entry of CATALOG.indexed) {
    if (
      entry.lowerName === normalized ||
      entry.lowerShortcodes.includes(normalized)
    ) {
      exact.push(entry.item);
      continue;
    }

    if (
      entry.lowerName.startsWith(normalized) ||
      entry.lowerShortcodes.some((code) => code.startsWith(normalized))
    ) {
      prefix.push(entry.item);
      continue;
    }

    if (
      entry.lowerName.includes(normalized) ||
      entry.lowerShortcodes.some((code) => code.includes(normalized))
    ) {
      substring.push(entry.item);
      continue;
    }

    if (entry.lowerTags.some((tag) => tag.includes(normalized))) {
      tagMatch.push(entry.item);
    }
  }

  const results: LocalEmojiItem[] = [];
  for (const bucket of [exact, prefix, substring, tagMatch]) {
    for (const item of bucket) {
      results.push(item);
      if (results.length >= limit) {
        return results;
      }
    }
  }
  return results;
}
