import { useTranslation } from "react-i18next";
import { BackgroundLogo } from "@/components/common/logo";

export function SettingsSidebarHeader() {
  const { t } = useTranslation("settings");
  return (
    <div className="flex shrink-0 items-center gap-2 px-2 pb-3">
      <BackgroundLogo className="size-7 shrink-0" />
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-medium text-primary">{t("dialogTitle")}</p>
        <p className="truncate text-xs text-muted-foreground">Nanoboard</p>
      </div>
    </div>
  );
}
