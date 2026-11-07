import type { Locale } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { fr } from "date-fns/locale/fr";
import { isAppLocale, type AppLocale } from "./locale-preference";

/**
 * The date-fns locale object matching a resolved app locale, for third-party
 * built-in UI (the DayPicker `locale` prop). date-fns locales are objects,
 * not Intl tags, so they need this map — one entry per supported locale.
 * Anything unknown falls back to the default locale object.
 */
const DATE_LOCALES: Record<AppLocale, Locale> = {
  "en-US": enUS,
  "fr-FR": fr,
};

export function getDateLocale(locale: AppLocale | string): Locale {
  return isAppLocale(locale) ? DATE_LOCALES[locale] : DATE_LOCALES["en-US"];
}
