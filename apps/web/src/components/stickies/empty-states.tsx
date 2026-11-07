import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import Stickies from "@/icons/stickies";
import { AddStickyButton } from "./add-sticky-button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";

type EmptyStickiesProps = {
  onAddSticky: () => void;
  isCreating?: boolean;
};

export function EmptyStickiesState({
  onAddSticky,
  isCreating = false,
}: EmptyStickiesProps) {
  const { t } = useTranslation("stickies");
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12">
          <Stickies className="size-7" />
        </EmptyMedia>
        <EmptyTitle>{t("empty.title")}</EmptyTitle>
        <EmptyDescription>{t("empty.description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <AddStickyButton onClick={onAddSticky} isCreating={isCreating} />
      </EmptyContent>
    </Empty>
  );
}

type EmptySearchProps = {
  onAddSticky: () => void;
  isCreating?: boolean;
};

export function EmptySearchState({
  onAddSticky,
  isCreating = false,
}: EmptySearchProps) {
  const { t } = useTranslation("stickies");
  return (
    <div className="flex size-full flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <h3 className="mb-1.5 font-heading font-semibold text-base text-foreground">
        {t("empty.searchTitle")}
      </h3>
      <p className="mb-5 max-w-xs text-muted-foreground text-xs leading-relaxed sm:text-sm">
        {t("empty.searchDescription")}
      </p>
      <AddStickyButton onClick={onAddSticky} isCreating={isCreating} />
    </div>
  );
}
