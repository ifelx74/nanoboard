import { Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  isCreating?: boolean;
  className?: string;
};

export function AddStickyButton({
  onClick,
  isCreating = false,
  className,
}: Props) {
  const { t } = useTranslation("stickies");
  return (
    <Button
      onClick={onClick}
      disabled={isCreating}
      size="sm"
      className={cn("gap-1.5", className)}
    >
      {isCreating ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Plus className="size-3.5" />
      )}
      <span>{t("addSticky")}</span>
    </Button>
  );
}
