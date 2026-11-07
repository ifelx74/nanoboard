import { useNavigate } from "@tanstack/react-router";
import { House, PencilRuler } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";

/**
 * First-run dead end: the gallery is empty because whiteboards come into
 * existence by drawing inside a project — there is no create flow to point
 * at, so the message explains that and offers the way back Home.
 */
export function GalleryEmptyState() {
  const navigate = useNavigate();
  const { t } = useTranslation("whiteboard");

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12">
          <PencilRuler className="size-7" />
        </EmptyMedia>
        <EmptyTitle>{t("emptyState.title")}</EmptyTitle>
        <EmptyDescription>{t("emptyState.description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button size="sm" onClick={() => navigate({ to: "/" })}>
          <House className="size-3.5" />
          <span>{t("emptyState.backToHome")}</span>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
