/**
 * Compile-time translation keys, derived from the default-locale resources.
 * Augmenting i18next's CustomTypeOptions makes every `t()` call site check
 * its key against `en-US.json` — including the suffixed plural forms
 * (`overflowMore_one`, `overflowMore_other`) and the bare singular key
 * i18next resolves them through (`overflowMore`, with `{ count }`).
 */
import type enUS from "./locales/en-US.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: typeof enUS;
  }
}

/**
 * Narrow escape hatch for the rare genuinely dynamic key (e.g. iterating a
 * namespace's keys at runtime). Anything statically known must use the typed
 * surface instead — reach for this only when a key literally cannot be
 * written down at a call site, and prefer passing the literal through it so
 * the bypass stays visible in review.
 */
export function dynamicKey<T>(key: string): T {
  return key as T;
}
