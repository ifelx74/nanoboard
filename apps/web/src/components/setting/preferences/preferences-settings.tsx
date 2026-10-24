// local imports
import DefaultSettingPreferencesList from "./default-setting-perferences-list";
import InstallAppList from "./install-app-list";
import LanguageAndTimezoneList from "./language-and-timezone-list";
import { cn } from "@/lib/utils";

export const PreferencesSettings = () => {
  return (
    <div className="size-full">
      {/* Headding */}
      <div
        className={cn(
          "flex flex-col items-start justify-between gap-4 md:flex-row md:items-center",
        )}
      >
        <div className="flex flex-col items-start gap-1">
          <h6 className="font-medium text-primary">Preferences</h6>
          <p className="text-xs text-muted-foreground">
            Customize your app experience the way you work
          </p>
        </div>
      </div>
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
