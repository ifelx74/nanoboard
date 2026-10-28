import { lazy } from "react";
import type { SettingTab } from "@/constants/setting";

export const SETTING_PAGES_MAP: Record<
  SettingTab,
  React.LazyExoticComponent<React.FC>
> = {
  preferences: lazy(() =>
    import("./preferences").then((module) => ({
      default: module.PreferencesSettings,
    })),
  ),
  data: lazy(() =>
    import("./data").then((module) => ({
      default: module.DataSettings,
    })),
  ),
};
