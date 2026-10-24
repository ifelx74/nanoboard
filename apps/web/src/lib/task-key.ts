declare const projectKeyBrand: unique symbol;
/** Short uppercase project key (`WR`); the ticket-key half of `WR-1`. */
export type ProjectKey = string & { readonly [projectKeyBrand]: true };

export function taskKey(slug: string, number: number): string {
  if (!slug) return "";
  return `${slug.toUpperCase()}-${number}`;
}
