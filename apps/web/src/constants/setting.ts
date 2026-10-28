import { Database, SlidersHorizontal, type LucideIcon } from "lucide-react";

export type SettingTab = "preferences" | "data";

export type SettingNavItem = {
  key: SettingTab;
  label: string;
  icon: LucideIcon;
};

export const SETTING_NAV_ITEMS: SettingNavItem[] = [
  {
    key: "preferences",
    label: "Preferences",
    icon: SlidersHorizontal,
  },
  {
    key: "data",
    label: "Data",
    icon: Database,
  },
];
