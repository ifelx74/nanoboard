import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { SettingsContent } from "./settings-content";

export default function AppSettingDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={
          "max-h-[calc(100dvh-10rem)] max-w-[calc(100vw-2rem)] flex-col overflow-clip rounded-xl border-sm border-subtle shadow-raised-300 origin-(--transform-origin) transition-[opacity,transform] duration-200 motion-reduce:transition-none w-200 h-175 min-h-0"
        }
      >
        <div className="sr-only">
          <DialogTitle>Profile Settings</DialogTitle>
        </div>
        <div className="@container flex min-h-0 flex-1">
          <SettingsContent className="flex-1 rounded-r-xl" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
