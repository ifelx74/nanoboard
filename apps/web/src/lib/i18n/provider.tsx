import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { i18n } from "./index";

export function I18nProvider({ children }: { children: ReactNode }) {
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
