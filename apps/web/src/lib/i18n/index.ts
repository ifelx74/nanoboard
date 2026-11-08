import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { DEFAULT_LOCALE, type AppLocale } from "./locale-preference";
import { NAMESPACES } from "./locales";
import "./types";

export const i18n: I18nInstance = i18next.createInstance();

/**
 * Initialize the runtime for `locale`, loading its resources through the
 * lazy backend. Rejects if the locale's resources cannot be loaded — boot
 * catches and renders anyway, so a resource failure never bricks the app.
 */
export async function initI18n(locale: AppLocale): Promise<void> {
  return i18n
    .use(initReactI18next)
    .use(
      resourcesToBackend((language: string, namespace: string) =>
        import(`./locales/${language}.json`).then((module) => {
          const resources = module.default as Record<string, unknown>;
          return { default: resources[namespace] ?? {} };
        }),
      ),
    )
    .init({
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      // No supportedLngs restriction here: the preference layer (parse +
      // registry) is the gatekeeper, and the engine stays generic so a
      // future locale needs no runtime change.
      ns: [...NAMESPACES],
      defaultNS: "common",
      interpolation: { escapeValue: false },
    })
    .then(() => undefined);
}
