import { db, type NanoboardDB } from "./db";
import type { Page } from "./schema";

/**
 * Lightweight route-loader read for a single page's metadata row. Kept in its
 * own tiny module under `src/lib/db/` (ADR 0001) so TanStack Router's route
 * loader never pulls `@/lib/db/pages` (document helpers, duplication, archive
 * and delete logic) into the initial app-shell bundle.
 */
export function getPageMeta(
  pageId: string,
  database: NanoboardDB = db,
): Promise<Page | undefined> {
  return database.pages.get(pageId);
}
