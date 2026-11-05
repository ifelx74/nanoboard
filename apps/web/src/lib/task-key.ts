declare const projectKeyBrand: unique symbol;
/** Short uppercase project key (`WR`); the ticket-key half of `WR-1`. */
export type ProjectKey = string & { readonly [projectKeyBrand]: true };

/** Hard cap so a saturated namespace fails loudly instead of hanging. */
export const PROJECT_SLUG_MAX = 5;

const PROJECT_SLUG_FALLBACK = "PROJ";

export function taskKey(slug: string, number: number): string {
  if (!slug) return "";
  return `${slug.toUpperCase()}-${number}`;
}

/**
 * Derives the default project key from a display name: initials of the
 * first words (up to the cap), or the first word's prefix for one-word
 * names. Keys start with a letter; digit-led suggestions fall back.
 */
export function suggestProjectKey(name: string): ProjectKey {
  const words = name
    .normalize("NFKC")
    .toUpperCase()
    .split(/[\s_-]+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ""))
    .filter((word) => word.length > 0);
  if (words.length === 0) return PROJECT_SLUG_FALLBACK as ProjectKey;
  const first = words[0] as string;
  const candidate =
    words.length === 1
      ? first.slice(0, PROJECT_SLUG_MAX)
      : words
          .slice(0, PROJECT_SLUG_MAX)
          .map((word) => word[0] as string)
          .join("");
  const key = candidate.replace(/^[0-9]+/, "");
  return (key || PROJECT_SLUG_FALLBACK) as ProjectKey;
}
