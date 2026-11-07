import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  LOCALE_STORAGE_KEY,
  parseLocalePreference,
  resolveLocale,
  type LocalePreference,
} from "@/lib/i18n/locale-preference";
import { i18n } from "@/lib/i18n/index";

interface LocaleStore {
  locale: LocalePreference;
  setLocale: (locale: LocalePreference) => void;
}

/** The browser's preferred language, or null outside a DOM environment. */
export function getBrowserLocale(): string | null {
  if (typeof navigator === "undefined") return null;
  return navigator.languages?.[0] ?? navigator.language ?? null;
}

/** Resolve a preference against the browser locale with the pure logic. */
export function getResolvedLocale(preference: LocalePreference) {
  return resolveLocale(preference, getBrowserLocale());
}

/**
 * Per-device interface language, persisted across reloads via the same
 * zustand-persist envelope mechanism as the theme store. Holds the raw
 * preference ("system" or an explicit locale); the resolved concrete
 * locale drives the runtime and `document.lang` through `applyLocale`.
 */
export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: "system",
      setLocale: (locale) => {
        const next = parseLocalePreference(locale);
        set({ locale: next });
        applyLocale(next);
      },
    }),
    {
      name: LOCALE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        applyLocale(parseLocalePreference(state?.locale));
      },
    },
  ),
);

/**
 * Apply a preference: switch the runtime live (no reload) and track the
 * document language attribute. Idempotent — safe on every change and after
 * rehydration.
 */
export function applyLocale(preference: LocalePreference): void {
  const resolved = getResolvedLocale(preference);
  document.documentElement.lang = resolved;
  // Before boot's init runs there is nothing to switch; initI18n resolves
  // the locale itself, so only switch once the runtime is ready.
  if (i18n.isInitialized) void i18n.changeLanguage(resolved);
}
