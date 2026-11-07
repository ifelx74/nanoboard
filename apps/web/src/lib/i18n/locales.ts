/**
 * The app's domain namespaces: the top-level objects of each locale file.
 * Kept as a literal list so the runtime never statically bundles a locale
 * file — locales load lazily through the backend's dynamic import (see
 * `./index.ts`). The resource-integrity test asserts this list matches the
 * `en-US.json` top level exactly, so the two cannot drift apart.
 */
export const NAMESPACES = [
  "common",
  "navigation",
  "home",
  "board",
  "list",
  "calendar",
  "stickies",
  "whiteboard",
  "project",
  "task",
  "activity",
  "settings",
] as const;

export type Namespace = (typeof NAMESPACES)[number];
