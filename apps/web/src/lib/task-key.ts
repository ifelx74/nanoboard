declare const projectKeyBrand: unique symbol;
/** Short uppercase project key (`WR`); the ticket-key half of `WR-1`. */
export type ProjectKey = string & { readonly [projectKeyBrand]: true };

/**
 * Ticket key: the project's short key plus the per-project task number,
 * e.g. `WR-1`. Mirrors Kaneo's `SLUG-number` display. Empty slug yields an
 * empty key so loading states render nothing instead of `"-1"`.
 */
export function taskKey(slug: string, number: number): string {
  if (!slug) return "";
  return `${slug.toUpperCase()}-${number}`;
}
