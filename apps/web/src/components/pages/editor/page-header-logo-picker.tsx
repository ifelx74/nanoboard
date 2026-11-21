import { Smile } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLogoIcon } from "@/components/pages/page-logo";
import { db } from "@/lib/db/db";
import { updatePageLogo } from "@/lib/db/pages";
import type { Page, PageLogo } from "@/lib/db/schema";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PageEmojiIconPicker } from "./page-emoji-icon-picker";

export interface PageHeaderLogoPickerProps {
  page: Page;
  /** True when the live page title input is empty (keeps `"Icon"` visible). */
  isTitleEmpty: boolean;
  /** True when the page is locked or archived (hides all edit triggers). */
  disabled: boolean;
}

/**
 * Plane-styled page header logo bar mounted above the H1 title via
 * `PageEditorWorkspace`'s `headerTopSlot`.
 *
 * - Without a logo (editable): shows a 48px hover strip with `"Icon"` button
 *   (persistently visible when both title and logo are empty).
 * - With a logo: smoothly expands a 56×56px container rendering the chosen
 *   48px emoji or colored Lucide icon (clickable to edit/remove when editable,
 *   static display when locked or archived).
 */
export function PageHeaderLogoPicker({
  page,
  isTitleEmpty,
  disabled,
}: PageHeaderLogoPickerProps) {
  const { t } = useTranslation("pages");
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasLogo = page.logo !== null;

  useEffect(() => {
    if (disabled && pickerOpen) {
      setPickerOpen(false);
    }
  }, [disabled, pickerOpen]);

  function persistLogo(nextLogo: PageLogo | null) {
    void updatePageLogo(db, page.id, nextLogo).catch((error: unknown) => {
      const fallbackError = i18n.t("pages:logoPicker.saveError");
      toast.error(error instanceof Error ? error.message : fallbackError);
    });
  }

  return (
    <div className="mb-1 flex flex-col">
      {!hasLogo && !disabled && (
        <div className="flex h-12 items-end text-left">
          <div
            className={cn(
              "transition-opacity duration-200",
              isTitleEmpty || pickerOpen
                ? "opacity-100"
                : "opacity-0 group-hover/page-header:opacity-100 focus-within:opacity-100",
            )}
          >
            <PageEmojiIconPicker
              value={null}
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              defaultTab="emoji"
              onChange={(nextLogo) => persistLogo(nextLogo)}
              trigger={
                <button
                  type="button"
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    pickerOpen && "bg-accent text-foreground",
                  )}
                >
                  <Smile className="size-4 shrink-0" aria-hidden="true" />
                  <span>{t("logoPicker.addIcon")}</span>
                </button>
              }
            />
          </div>
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          hasLogo
            ? "mt-1 mb-1 max-h-14 opacity-100 px-2"
            : "pointer-events-none max-h-0 opacity-0",
        )}
      >
        {hasLogo &&
          (disabled ? (
            <div className="-ml-2 grid size-14 place-items-center rounded-sm">
              <PageLogoIcon
                logo={page.logo}
                className="size-12"
                emojiClassName="size-12 text-[44px] leading-none"
              />
            </div>
          ) : (
            <PageEmojiIconPicker
              value={page.logo}
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onChange={(nextLogo) => persistLogo(nextLogo)}
              onRemove={() => persistLogo(null)}
              trigger={
                <button
                  type="button"
                  aria-label={t("logoPicker.changeLogo")}
                  className={cn(
                    "-ml-2 grid size-14 cursor-pointer place-items-center rounded-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    pickerOpen && "bg-accent",
                  )}
                >
                  <PageLogoIcon
                    logo={page.logo}
                    className="size-12"
                    emojiClassName="size-12 text-[44px] leading-none"
                  />
                </button>
              }
            />
          ))}
      </div>
    </div>
  );
}
