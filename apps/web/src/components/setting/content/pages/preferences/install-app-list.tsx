import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { toast } from "@/lib/toast";
import { SettingsControlItem } from "../../../control-item";

export default function InstallAppList() {
  const { t } = useTranslation("settings");
  const { canInstall, isInstalled, isIos, install } = useInstallPrompt();

  const handleInstall = async () => {
    const outcome = await install();

    if (outcome === "accepted") {
      toast.success(t("install.installedToast"));
    } else if (outcome === "dismissed") {
      toast.info(t("install.dismissedToast"));
    } else {
      toast.info(t("install.browserMenuToast"));
    }
  };

  if (isInstalled) {
    return (
      <SettingsControlItem
        title={t("install.title")}
        description={t("install.installedDescription")}
        control={
          <Button variant="outline" size="sm" disabled>
            {t("install.installedButton")}
          </Button>
        }
      />
    );
  }

  if (canInstall) {
    return (
      <SettingsControlItem
        title={t("install.title")}
        description={t("install.installDescription")}
        control={
          <Button size="sm" onClick={handleInstall}>
            <Download aria-hidden="true" />
            {t("install.installButton")}
          </Button>
        }
      />
    );
  }

  return (
    <SettingsControlItem
      title={t("install.title")}
      description={
        isIos ? t("install.iosDescription") : t("install.browserDescription")
      }
      control={
        <Button variant="outline" size="sm" disabled>
          <Download aria-hidden="true" />
          {t("install.installButton")}
        </Button>
      }
    />
  );
}
