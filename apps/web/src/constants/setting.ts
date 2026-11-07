import { Database, SlidersHorizontal, type LucideIcon } from "lucide-react";

export type SettingTab = "preferences" | "data";

export type SettingNavItem = {
  key: SettingTab;
  icon: LucideIcon;
  labelKey: "tabs.preferences" | "tabs.data";
};

export const SETTING_NAV_ITEMS: SettingNavItem[] = [
  {
    key: "preferences",
    icon: SlidersHorizontal,
    labelKey: "tabs.preferences",
  },
  {
    key: "data",
    icon: Database,
    labelKey: "tabs.data",
  },
];
