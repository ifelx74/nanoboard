import type { AnyExtension, Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Image as ImageIcon } from "lucide-react";
import { db } from "@/lib/db/db";
import { savePageAsset } from "@/lib/db/page-assets";
import { i18n } from "@/lib/i18n";
import {
  PAGE_IMAGE_NODE_TYPE,
  PageImageExtension,
  type PageImageLightboxTarget,
  type UploadedPageImageResult,
} from "@/lib/pages/extensions/image-node";
import {
  PageImageValidationError,
  compressPageImage,
} from "@/lib/pages/image-upload";
import type { PageAssetUrlCache } from "@/lib/pages/object-url-cache";
import { toast } from "@/lib/toast";
import { PageImageNodeView } from "./page-image-node-view";
import type { PageSlashCommandAdditionalEntry } from "./page-slash-commands";

export interface CreatePageImageFeatureOptions {
  pageId: string;
  projectId: string;
  assetUrlCache: PageAssetUrlCache;
  onOpenLightbox: (target: PageImageLightboxTarget) => void;
}

export interface PageImageFeatureBundle {
  extension: AnyExtension;
  uniqueIdType: typeof PAGE_IMAGE_NODE_TYPE;
  slashCommand: PageSlashCommandAdditionalEntry;
  insertImage: (editor: Editor) => void;
}

function getValidationErrorMessage(error: PageImageValidationError): string {
  switch (error.code) {
    case "unsupported-type": {
      const msg = i18n.t("pages:image.errors.unsupportedType");
      return msg;
    }
    case "file-too-large": {
      const msg = i18n.t("pages:image.errors.fileTooLarge");
      return msg;
    }
    case "empty-file": {
      const msg = i18n.t("pages:image.errors.emptyFile");
      return msg;
    }
  }
}

/**
 * Wires Ticket 06's offline-first image stack (validation, client compression,
 * `pageAssets` persistence, shared `ObjectURL` cache registration, TipTap
 * extension + NodeView, `/image` slash command, and sticky toolbar insert).
 */
export function createPageImageFeature({
  pageId,
  projectId,
  assetUrlCache,
  onOpenLightbox,
}: CreatePageImageFeatureOptions): PageImageFeatureBundle {
  const onUploadFile = async (
    file: File,
  ): Promise<UploadedPageImageResult | null> => {
    try {
      const prepared = await compressPageImage(file, { name: file.name });
      const saved = await savePageAsset(db, {
        pageId,
        projectId,
        name: prepared.name,
        mimeType: prepared.mimeType,
        blob: prepared.blob,
      });

      assetUrlCache.register(saved.id, saved.blob, saved);

      const aspectRatio =
        prepared.width && prepared.height && prepared.height > 0
          ? prepared.width / prepared.height
          : null;

      return {
        assetId: saved.id,
        name: saved.name,
        mimeType: saved.mimeType,
        aspectRatio,
      };
    } catch (error: unknown) {
      if (error instanceof PageImageValidationError) {
        const validationMessage = getValidationErrorMessage(error);
        toast.error(validationMessage);
        return null;
      }
      const uploadError = i18n.t("pages:image.errors.uploadFailed");
      toast.error(uploadError);
      return null;
    }
  };

  const extension = PageImageExtension.configure({
    nodeViewRenderer: ReactNodeViewRenderer(PageImageNodeView),
    onUploadFile,
    onOpenLightbox,
  });

  const slashCommand: PageSlashCommandAdditionalEntry = {
    section: "general",
    pushAfter: "code",
    item: {
      key: "image",
      commandKey: "image",
      title: i18n.t("pages:image.slashTitle"),
      description: i18n.t("pages:image.slashDesc"),
      searchTerms: ["image", "img", "photo", "picture", "upload", "media"],
      icon: <ImageIcon className="size-3.5" aria-hidden="true" />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertPendingImage().run();
      },
    },
  };

  const insertImage = (editor: Editor) => {
    if (!editor.isEditable) return;
    editor.chain().focus().insertPendingImage().run();
  };

  return {
    extension,
    uniqueIdType: PAGE_IMAGE_NODE_TYPE,
    slashCommand,
    insertImage,
  };
}
