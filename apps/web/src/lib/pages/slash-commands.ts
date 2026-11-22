export type SlashCommandSectionKey =
  "general" | "text-colors" | "background-colors";

export interface SlashCommandItemBase {
  key: string;
  commandKey: string;
  title: string;
  description: string;
  searchTerms: readonly string[];
}

export interface SlashCommandSection<T extends SlashCommandItemBase> {
  key: SlashCommandSectionKey;
  title?: string;
  items: T[];
}

export interface SlashCommandAdditionalEntry<T extends SlashCommandItemBase> {
  section: SlashCommandSectionKey;
  /** Insert immediately after the item whose `commandKey` matches; appends to section end if not found. */
  pushAfter?: string;
  item: T;
}

export interface SlashCommandSelectionIndex {
  section: number;
  item: number;
}

export interface HighlightMatchParts {
  before: string;
  match: string;
  after: string;
}

/**
 * Clones sections, merges downstream additional slash-command items cleanly
 * into their target section after `pushAfter`, and removes any disabled items.
 */
export function mergeAdditionalSlashItems<T extends SlashCommandItemBase>(
  baseSections: readonly SlashCommandSection<T>[],
  additionalEntries: readonly SlashCommandAdditionalEntry<T>[] = [],
  disabledKeys: readonly string[] = [],
): SlashCommandSection<T>[] {
  const disabledSet = new Set(disabledKeys);
  const cloned: SlashCommandSection<T>[] = baseSections.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !disabledSet.has(item.key) && !disabledSet.has(item.commandKey),
    ),
  }));

  for (const entry of additionalEntries) {
    if (
      disabledSet.has(entry.item.key) ||
      disabledSet.has(entry.item.commandKey)
    ) {
      continue;
    }
    const targetSection =
      cloned.find((section) => section.key === entry.section) ?? cloned[0];
    if (!targetSection) continue;

    if (entry.pushAfter) {
      const anchorIndex = targetSection.items.findIndex(
        (item) => item.commandKey === entry.pushAfter,
      );
      if (anchorIndex !== -1) {
        targetSection.items.splice(anchorIndex + 1, 0, entry.item);
        continue;
      }
    }
    targetSection.items.push(entry.item);
  }

  return cloned.filter((section) => section.items.length > 0);
}

/**
 * Filters slash command sections by case-insensitive substring match against
 * item `title`, `description`, and `searchTerms`, removing empty sections.
 */
export function filterSlashCommandSections<T extends SlashCommandItemBase>(
  sections: readonly SlashCommandSection<T>[],
  query: string,
): SlashCommandSection<T>[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return sections
      .map((section) => ({ ...section, items: [...section.items] }))
      .filter((section) => section.items.length > 0);
  }

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery) ||
          item.searchTerms.some((term) =>
            term.toLowerCase().includes(normalizedQuery),
          ),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Splits `text` around the first case-insensitive match of `query` so the UI
 * can emphasize the matched substring while preserving original casing.
 */
export function splitHighlightMatch(
  text: string,
  query: string,
): HighlightMatchParts | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const index = text.toLowerCase().indexOf(normalizedQuery);
  if (index < 0) return null;

  return {
    before: text.slice(0, index),
    match: text.slice(index, index + normalizedQuery.length),
    after: text.slice(index + normalizedQuery.length),
  };
}

/**
 * Computes the next valid `(section, item)` cursor index across multi-section
 * slash-command results with smooth wrap-around.
 */
export function getNextSlashCommandIndex<T extends SlashCommandItemBase>(
  sections: readonly SlashCommandSection<T>[],
  current: SlashCommandSelectionIndex,
  direction: "up" | "down",
): SlashCommandSelectionIndex | null {
  if (sections.length === 0) return null;

  const currentSection = Math.min(
    Math.max(current.section, 0),
    sections.length - 1,
  );
  const itemsInCurrent = sections[currentSection]?.items.length ?? 0;
  if (itemsInCurrent === 0) return null;

  if (direction === "down") {
    const nextItem = current.item + 1;
    if (nextItem < itemsInCurrent) {
      return { section: currentSection, item: nextItem };
    }
    const nextSection = (currentSection + 1) % sections.length;
    return { section: nextSection, item: 0 };
  }

  const prevItem = current.item - 1;
  if (prevItem >= 0) {
    return { section: currentSection, item: prevItem };
  }
  const prevSection = (currentSection - 1 + sections.length) % sections.length;
  const prevSectionLength = sections[prevSection]?.items.length ?? 0;
  return {
    section: prevSection,
    item: Math.max(prevSectionLength - 1, 0),
  };
}
