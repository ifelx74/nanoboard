import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { i18n } from "./index";
import { getBrowserLocale, useLocaleStore } from "@/store/locale";
import { resolveLocale } from "./locale-preference";

/**
 * Component-side half of the runtime (the singleton in `./index` serves
 * imperative code such as toasts). Applies the persisted preference: on
 * every change it re-resolves the locale, switches the runtime live with
 * no reload, and tracks `document.lang` so assistive technology pronounces
 * the interface in the right language.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const preference = useLocaleStore((state) => state.locale);

  useEffect(() => {
    const resolved = resolveLocale(preference, getBrowserLocale());
    void i18n.changeLanguage(resolved);
  }, [preference]);

  useEffect(() => {
    const syncDocumentLang = (language: string | undefined) => {
      if (language) document.documentElement.lang = language;
    };
    syncDocumentLang(i18n.resolvedLanguage ?? i18n.language);
    i18n.on("languageChanged", syncDocumentLang);
    return () => {
      i18n.off("languageChanged", syncDocumentLang);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
