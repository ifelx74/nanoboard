import { useTranslation } from "react-i18next";
import { SettingsHeading } from "../../../heading";
import DefaultSettingPreferencesList from "./default-preferences-list";
// import InstallAppList from "./install-app-list";
import LanguageAndTimezoneList from "./language-and-timezone-list";

export const PreferencesSettings = () => {
  const { t } = useTranslation("settings");
  return (
    <div className="size-full">
      <SettingsHeading
        title={t("preferences.title")}
        description={t("preferences.description")}
      />
      <div className="mt-7 flex w-full flex-col gap-6">
        <section>
          <DefaultSettingPreferencesList />
        </section>
        <section className="flex flex-col gap-y-3">
          <div className="font-medium text-primary">
            {t("preferences.languageTime")}
          </div>
          <LanguageAndTimezoneList />
        </section>
        {/* <section className="mt-auto border-t border-border">
          <InstallAppList />
        </section> */}
      </div>
    </div>
  );
};
