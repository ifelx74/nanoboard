import { useTranslation } from "react-i18next";
import { SETTING_NAV_ITEMS, type SettingTab } from "@/constants/setting";
import { SettingsSidebarItem } from "./item";

type Props = {
  activeTab: SettingTab;
  updateActiveTab: (tab: SettingTab) => void;
};

export function SettingsSidebarItemCategories(props: Props) {
  const { activeTab, updateActiveTab } = props;
  const { t } = useTranslation("settings");

  return (
    <div className="flex flex-col gap-0.5 mt-2">
      {SETTING_NAV_ITEMS.map((item) => (
        <SettingsSidebarItem
          key={item.key}
          icon={item.icon}
          isActive={activeTab === item.key}
          label={
            item.labelKey === "tabs.preferences"
              ? t("tabs.preferences")
              : t("tabs.data")
          }
          onClick={() => updateActiveTab(item.key)}
        />
      ))}
    </div>
  );
}
