import { SettingsHeading } from "../../../heading";
import DefaultSettingPreferencesList from "./default-preferences-list";
import InstallAppList from "./install-app-list";
import LanguageAndTimezoneList from "./language-and-timezone-list";

export const PreferencesSettings = () => {
  return (
    <div className="size-full">
      <SettingsHeading
        title="Preferences"
        description="Customize your app experience the way you work"
      />
      <div className="mt-7 flex w-full flex-col gap-6">
        <section>
          <DefaultSettingPreferencesList />
        </section>
        <section className="flex flex-col gap-y-3">
          <div className="font-medium text-primary">Language & Time</div>
          <LanguageAndTimezoneList />
        </section>
        <section className="mt-auto border-t border-border">
          <InstallAppList />
        </section>
      </div>
    </div>
  );
};
