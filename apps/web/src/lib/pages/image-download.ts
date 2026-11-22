import { triggerBlobDownload } from "@/lib/download";
import { i18n } from "@/lib/i18n";
import {
  deriveExternalImageFileName,
  validateExternalImageUrl,
} from "@/lib/pages/image-upload";
import type { PageAssetUrlCache } from "@/lib/pages/object-url-cache";
import { toast } from "@/lib/toast";

export interface DownloadPageImageInput {
  assetId?: string | null;
  src?: string | null;
  name?: string | null;
}

/**
 * Downloads either a local `pageAssets` image (reading its Blob through the
 * shared page cache) or a validated external `http(s)` image without making
 * any app-managed network fetch calls. Shared by the Image NodeView hover bar,
 * fullscreen lightbox, and Ticket 07's right-pane Assets tab.
 */
export async function downloadPageImage(
  cache: PageAssetUrlCache | null,
  input: DownloadPageImageInput,
): Promise<boolean> {
  if (input.assetId && cache) {
    try {
      const entry = await cache.acquireEntry(input.assetId);
      if (!entry?.asset) {
        const missingMsg = i18n.t("pages:image.errors.downloadFailed");
        toast.error(missingMsg);
        return false;
      }
      const fileName = input.name?.trim() || entry.asset.name || "image";
      triggerBlobDownload(entry.asset.blob, fileName);
      return true;
    } catch {
      const errorMsg = i18n.t("pages:image.errors.downloadFailed");
      toast.error(errorMsg);
      return false;
    }
  }

  if (input.src) {
    const safeSrc = validateExternalImageUrl(input.src);
    if (!safeSrc) {
      const invalidMsg = i18n.t("pages:image.errors.downloadFailed");
      toast.error(invalidMsg);
      return false;
    }
    const anchor = globalThis.document.createElement("a");
    anchor.href = safeSrc;
    anchor.download =
      input.name?.trim() || deriveExternalImageFileName(safeSrc);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    globalThis.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    return true;
  }

  return false;
}
