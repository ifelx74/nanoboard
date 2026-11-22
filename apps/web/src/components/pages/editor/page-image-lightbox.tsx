import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Download, ImageOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PageImageLightboxTarget } from "@/lib/pages/extensions/image-node";
import { downloadPageImage } from "@/lib/pages/image-download";
import { validateExternalImageUrl } from "@/lib/pages/image-upload";
import {
  useOptionalPageAssetUrlCache,
  usePageAssetUrl,
} from "./page-asset-url-context";

export interface PageImageLightboxProps {
  target: PageImageLightboxTarget | null;
  onClose: () => void;
}

/**
 * Fullscreen image preview lightbox for Pages. Works in both editable and
 * read-only (locked/archived) modes and reuses the page's shared ObjectURL
 * cache without allocating duplicate object URLs.
 */
export function PageImageLightbox({ target, onClose }: PageImageLightboxProps) {
  const { t } = useTranslation("pages");
  const cache = useOptionalPageAssetUrlCache();
  const localAsset = usePageAssetUrl(target?.assetId);

  const safeExternalSrc = target?.src
    ? validateExternalImageUrl(target.src)
    : null;
  const resolvedSrc = target?.assetId ? localAsset.url : safeExternalSrc;
  const displayName = target?.name || target?.alt || t("image.lightboxTitle");

  return (
    <DialogPrimitive.Root
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <DialogPrimitive.Popup className="relative flex max-h-[92vh] max-w-[94vw] flex-col items-center gap-3 outline-none transition-all duration-200 ease-out data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0">
            <DialogPrimitive.Title className="sr-only">
              {displayName}
            </DialogPrimitive.Title>

            <div className="flex w-full items-center justify-between gap-4 rounded-md bg-black/75 px-3 py-2 text-xs text-white/90 backdrop-blur-xs">
              <span className="max-w-[60vw] truncate font-medium">
                {displayName}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {target && (
                  <button
                    type="button"
                    onClick={() =>
                      void downloadPageImage(cache, {
                        assetId: target.assetId,
                        src: target.src,
                        name: target.name,
                      })
                    }
                    title={t("image.download")}
                    aria-label={t("image.download")}
                    className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs text-white/90 transition-colors hover:bg-white/15 hover:text-white"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {t("image.download")}
                    </span>
                  </button>
                )}
                <DialogPrimitive.Close
                  aria-label={t("image.closeLightbox")}
                  title={t("image.closeLightbox")}
                  className="grid size-7 cursor-pointer place-items-center rounded-sm text-white/90 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <X className="size-4" aria-hidden="true" />
                </DialogPrimitive.Close>
              </div>
            </div>

            {resolvedSrc ? (
              <img
                src={resolvedSrc}
                alt={target?.alt || displayName}
                className="max-h-[80vh] max-w-[90vw] rounded-md object-contain shadow-2xl select-none"
              />
            ) : (
              <div className="flex h-48 w-72 flex-col items-center justify-center gap-2 rounded-lg border border-white/15 bg-black/60 text-sm text-white/70">
                <ImageOff className="size-6" aria-hidden="true" />
                <span>{t("image.missing")}</span>
              </div>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
