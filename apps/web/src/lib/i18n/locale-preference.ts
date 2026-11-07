/**
 * Pure locale-preference logic (parse / resolve), kept DOM-free so the plain
 * Node harness covers it directly — mirroring `lib/theme-preference.ts`.
 * Storage effects and `document.lang` application live in `store/locale.ts`;
 * the browser locale is passed in as data rather than read from `navigator`
 * here, so resolution is a pure function of its arguments.
 */

/** Every locale the registry ships; the default is the only entry for now. */
export const SUPPORTED_LOCALES = ["en-US"] as const;

/** The locale a fresh user — and every fallback chain — lands on. */
export const DEFAULT_LOCALE = "en-US";

/** A concrete supported locale, as opposed to a preference value. */
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * What the user can store: the explicit "system" choice, or a supported
 * locale. "system" resolves through the browser language at read time.
 */
export type LocalePreference = "system" | AppLocale;

/** zustand persist storage key for the locale store envelope. */
export const LOCALE_STORAGE_KEY = "nanoboard-locale";

/** Allow-list check for explicit supported locales. */
export function isAppLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Allow-list parse: "system" or a supported locale. Anything else — a
 * foreign locale, a corrupt value, a wrong type — fails closed to "system",
 * which the resolution step then maps onto the default locale (or a
 * browser-language match if a future locale covers it). Old or tampered
 * data can therefore never break the app.
 */
export function parseLocalePreference(value: unknown): LocalePreference {
  if (value === "system") return "system";
  return isAppLocale(value) ? value : "system";
}

/**
 * Resolve a preference to the concrete locale to render, given the browser
 * locale:
 *  - an explicit supported locale is used as-is;
 *  - "system" tries the browser locale verbatim, then a same-language
 *    candidate among the supported locales, then the default;
 *  - anything corrupt fails closed to the default locale.
 */
export function resolveLocale(
  preference: LocalePreference,
  browserLocale: string | null | undefined,
  supported: readonly string[] = SUPPORTED_LOCALES,
): AppLocale {
  if (isAppLocale(preference) && supported.includes(preference)) {
    return preference;
  }
  if (preference === "system" && typeof browserLocale === "string") {
    if ((supported as readonly string[]).includes(browserLocale)) {
      return browserLocale as AppLocale;
    }
    const language = browserLocale.split("-")[0]?.toLowerCase();
    if (language) {
      const sameLanguage = supported.find(
        (locale) => locale.split("-")[0]?.toLowerCase() === language,
      );
      if (sameLanguage) return sameLanguage as AppLocale;
    }
  }
  return DEFAULT_LOCALE;
}
