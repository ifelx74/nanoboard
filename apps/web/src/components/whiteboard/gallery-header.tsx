import { PencilRuler } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SidebarTriggerHeader } from "../common/sidebar-trigger-header";
import Layout from "../common/layout";

/**
 * The gallery's title-only header: sidebar toggle, then the page identity.
 * No search, no create button — the gallery is a pure launcher (whiteboards
 * come into existence by drawing inside a project).
 */
export function GalleryHeader() {
  const { t } = useTranslation("whiteboard");
  return (
    <Layout.Header>
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-1">
          <SidebarTriggerHeader />
          <div className="flex items-center gap-1.5">
            <PencilRuler className="size-4 shrink-0" />
            <span className="text-sm font-semibold text-card-foreground">
              {t("header.title")}
            </span>
          </div>
        </div>
      </div>
    </Layout.Header>
  );
}
