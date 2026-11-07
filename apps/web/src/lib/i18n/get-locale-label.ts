import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "./locale-preference";

/**
 * Label a supported locale in its own language via the platform's
 * display-names API (mirroring the Kaneo label helper): "en-US" reads
 * "English" wherever the switcher lists it. Anything the platform cannot
 * label falls back to the raw code, so the control always renders.
 */
export function getLocaleLabel(locale: string): string {
  const language = locale.split("-")[0];
  if (!language) return locale;
  try {
    const label = new Intl.DisplayNames([locale], { type: "language" }).of(
      language,
    );
    return label && label !== language ? label : locale;
  } catch {
    return locale;
  }
}

/** The locale a switcher option should display, gated on the registry. */
export function getSupportedLocaleLabel(
  locale: AppLocale | string,
): string {
  return getLocaleLabel(isAppLocale(locale) ? locale : DEFAULT_LOCALE);
}
