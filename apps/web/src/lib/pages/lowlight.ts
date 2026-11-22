import { common, createLowlight } from "lowlight";

/**
 * Module-level singleton `lowlight` instance registered with `common`
 * languages (which already includes `typescript` and the `ts` alias).
 * Kept strictly inside the lazy Pages editor chunk so zero highlighter code
 * lands on the initial boot path.
 */
export const pagesLowlight = createLowlight(common);
