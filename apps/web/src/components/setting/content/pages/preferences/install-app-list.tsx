import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { toast } from "@/lib/toast";
import { SettingsControlItem } from "../../../control-item";

export default function InstallAppList() {
  const { canInstall, isInstalled, isIos, install } = useInstallPrompt();

  const handleInstall = async () => {
    const outcome = await install();

    if (outcome === "accepted") {
      toast.success("Nanoboard installed");
    } else if (outcome === "dismissed") {
      toast.info("Installation dismissed");
    } else {
      toast.info("Use your browser menu to install Nanoboard");
    }
  };

  if (isInstalled) {
    return (
      <SettingsControlItem
        title="Install app"
        description="Nanoboard is installed and available offline."
        control={
          <Button variant="outline" size="sm" disabled>
            Installed
          </Button>
        }
      />
    );
  }

  if (canInstall) {
    return (
      <SettingsControlItem
        title="Install app"
        description="Install Nanoboard to keep working offline."
        control={
          <Button size="sm" onClick={handleInstall}>
            <Download aria-hidden="true" />
            Install
          </Button>
        }
      />
    );
  }

  return (
    <SettingsControlItem
      title="Install app"
      description={
        isIos
          ? "Tap Share, then Add to Home Screen to install Nanoboard."
          : "Use your browser's install option to add Nanoboard to your device."
      }
      control={
        <Button variant="outline" size="sm" disabled>
          <Download aria-hidden="true" />
          Install
        </Button>
      }
    />
  );
}
