import {
  Node,
  mergeAttributes,
  type Editor,
  type NodeViewRenderer,
} from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  deriveExternalImageFileName,
  validateExternalImageUrl,
} from "@/lib/pages/image-upload";

export const PAGE_IMAGE_NODE_TYPE = "image" as const;
export const PAGE_IMAGE_DEFAULT_WIDTH = "35%";
export const PAGE_IMAGE_MIN_WIDTH_PX = 100;

export type PageImageAlignment = "left" | "center" | "right";

export function isPageImageAlignment(
  value: unknown,
): value is PageImageAlignment {
  return value === "left" || value === "center" || value === "right";
}

/**
 * Canonical DOM anchor ID for a Page image block (`#image-<uniqueId>`).
 * Shared by the Image NodeView and Ticket 07's right-pane Assets tab jump links.
 */
export function getPageImageAnchorId(nodeId: string): string {
  return `image-${nodeId}`;
}

export interface UploadedPageImageResult {
  assetId: string;
  name: string;
  mimeType: string;
  aspectRatio: number | null;
}

export interface PageImageLightboxTarget {
  assetId: string | null;
  src: string | null;
  name: string;
  alt: string;
}

export interface InsertLocalPageImageAttrs {
  assetId: string;
  name?: string | null;
  alt?: string;
  width?: string | null;
  alignment?: PageImageAlignment;
  aspectRatio?: number | null;
}

export interface InsertExternalPageImageAttrs {
  src: string;
  name?: string | null;
  alt?: string;
  width?: string | null;
  alignment?: PageImageAlignment;
  aspectRatio?: number | null;
}

export interface PageImageExtensionOptions {
  /** React NodeView renderer injected by the UI layer. */
  nodeViewRenderer?: NodeViewRenderer;
  /**
   * Validates, compresses, saves to `pageAssets`, and registers in the
   * page-scoped `ObjectURL` cache. Surfaces toast errors and returns `null` on
   * validation/persistence failure.
   */
  onUploadFile?: (file: File) => Promise<UploadedPageImageResult | null>;
  /** Opens the page-level fullscreen image lightbox. */
  onOpenLightbox?: (target: PageImageLightboxTarget) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageImage: {
      insertPendingImage: () => ReturnType;
      insertLocalImage: (attrs: InsertLocalPageImageAttrs) => ReturnType;
      insertExternalImage: (attrs: InsertExternalPageImageAttrs) => ReturnType;
    };
  }
}

function collectClipboardFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];
  const directFiles = Array.from(clipboardData.files ?? []);
  if (directFiles.length > 0) return directFiles;

  const itemFiles: File[] = [];
  for (const item of Array.from(clipboardData.items ?? [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) itemFiles.push(file);
  }
  return itemFiles;
}

async function uploadAndInsertFiles(
  editor: Editor,
  files: readonly File[],
  onUploadFile: (file: File) => Promise<UploadedPageImageResult | null>,
  insertPos?: number,
): Promise<void> {
  const uploaded: UploadedPageImageResult[] = [];
  for (const file of files) {
    const result = await onUploadFile(file);
    if (result) {
      uploaded.push(result);
    }
  }
  if (uploaded.length === 0 || editor.isDestroyed || !editor.isEditable) {
    return;
  }

  const nodes = uploaded.map((item) => ({
    type: PAGE_IMAGE_NODE_TYPE,
    attrs: {
      assetId: item.assetId,
      src: null,
      name: item.name,
      alt: item.name,
      width: PAGE_IMAGE_DEFAULT_WIDTH,
      alignment: "left" as const,
      aspectRatio: item.aspectRatio,
    },
  }));

  if (insertPos !== undefined) {
    const clampedPos = Math.max(
      0,
      Math.min(insertPos, editor.state.doc.content.size),
    );
    editor.chain().focus().insertContentAt(clampedPos, nodes).run();
    return;
  }

  editor.chain().focus().insertContent(nodes).run();
}

/**
 * Custom TipTap v3 block Image extension for Pages.
 *
 * Schema contract for Tickets 06, 07, and 08:
 * - Node name: `"image"` (top-level block atom, draggable, selectable)
 * - `attrs.id`: assigned by `UniqueID` (`#image-<id>` DOM anchor)
 * - `attrs.assetId`: local IndexedDB `pageAssets.id` (never base64-inlined)
 * - `attrs.src`: validated external `http:`/`https:` URL (null for local assets)
 * - `attrs.name`: display/download filename
 * - `attrs.alt`: alt text / caption fallback for Markdown serialization
 * - `attrs.width`: responsive width string (default `"35%"`)
 * - `attrs.alignment`: `"left" | "center" | "right"`
 * - `attrs.aspectRatio`: optional natural aspect ratio (`width / height`)
 */
export const PageImageExtension = Node.create<PageImageExtensionOptions>({
  name: PAGE_IMAGE_NODE_TYPE,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      nodeViewRenderer: undefined,
      onUploadFile: undefined,
      onOpenLightbox: undefined,
    };
  },

  addAttributes() {
    return {
      assetId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-asset-id") || null,
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.assetId === "string" && attributes.assetId
            ? { "data-asset-id": attributes.assetId }
            : {},
      },
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw =
            element.getAttribute("data-src") ??
            element.getAttribute("src") ??
            element.querySelector("img")?.getAttribute("src") ??
            "";
          return validateExternalImageUrl(raw);
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (typeof attributes.src !== "string") return {};
          const safe = validateExternalImageUrl(attributes.src);
          return safe ? { "data-src": safe } : {};
        },
      },
      name: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-name") || null,
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.name === "string" && attributes.name
            ? { "data-name": attributes.name }
            : {},
      },
      alt: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-alt") ??
          element.getAttribute("alt") ??
          element.querySelector("img")?.getAttribute("alt") ??
          "",
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.alt === "string" && attributes.alt
            ? { "data-alt": attributes.alt }
            : {},
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-width") || null,
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.width === "string" && attributes.width
            ? { "data-width": attributes.width }
            : {},
      },
      alignment: {
        default: "left" as PageImageAlignment,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-alignment");
          return isPageImageAlignment(raw) ? raw : "left";
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-alignment": isPageImageAlignment(attributes.alignment)
            ? attributes.alignment
            : "left",
        }),
      },
      aspectRatio: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-aspect-ratio");
          if (!raw) return null;
          const parsed = Number.parseFloat(raw);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.aspectRatio === "number" &&
          Number.isFinite(attributes.aspectRatio) &&
          attributes.aspectRatio > 0
            ? { "data-aspect-ratio": String(attributes.aspectRatio) }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'figure[data-type="page-image"]' },
      {
        tag: "img[src]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const safeSrc = validateExternalImageUrl(
            element.getAttribute("src") ?? "",
          );
          if (!safeSrc) return false;
          const alt = element.getAttribute("alt") ?? "";
          return {
            assetId: null,
            src: safeSrc,
            name: deriveExternalImageFileName(safeSrc),
            alt,
            width: PAGE_IMAGE_DEFAULT_WIDTH,
            alignment: "left",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const safeSrc =
      typeof node.attrs.src === "string"
        ? validateExternalImageUrl(node.attrs.src)
        : null;
    const nodeId = typeof node.attrs.id === "string" ? node.attrs.id : null;
    const figureAttrs = mergeAttributes(HTMLAttributes, {
      "data-type": "page-image",
      ...(nodeId ? { id: getPageImageAnchorId(nodeId) } : {}),
    });

    if (safeSrc) {
      return [
        "figure",
        figureAttrs,
        [
          "img",
          {
            src: safeSrc,
            alt: typeof node.attrs.alt === "string" ? node.attrs.alt : "",
          },
        ],
      ];
    }

    return ["figure", figureAttrs];
  },

  addCommands() {
    return {
      insertPendingImage:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              assetId: null,
              src: null,
              name: null,
              alt: "",
              width: null,
              alignment: "left",
              aspectRatio: null,
            },
          }),
      insertLocalImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              assetId: attrs.assetId,
              src: null,
              name: attrs.name ?? null,
              alt: attrs.alt ?? attrs.name ?? "",
              width: attrs.width ?? PAGE_IMAGE_DEFAULT_WIDTH,
              alignment: attrs.alignment ?? "left",
              aspectRatio: attrs.aspectRatio ?? null,
            },
          }),
      insertExternalImage:
        (attrs) =>
        ({ commands }) => {
          const safeSrc = validateExternalImageUrl(attrs.src);
          if (!safeSrc) return false;
          const derivedName =
            attrs.name ?? deriveExternalImageFileName(safeSrc);
          return commands.insertContent({
            type: this.name,
            attrs: {
              assetId: null,
              src: safeSrc,
              name: derivedName,
              alt: attrs.alt ?? derivedName,
              width: attrs.width ?? PAGE_IMAGE_DEFAULT_WIDTH,
              alignment: attrs.alignment ?? "left",
              aspectRatio: attrs.aspectRatio ?? null,
            },
          });
        },
    };
  },

  addNodeView() {
    if (!this.options.nodeViewRenderer) {
      return null;
    }
    return this.options.nodeViewRenderer;
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const getOnUploadFile = () => this.options.onUploadFile;

    return [
      new Plugin({
        key: new PluginKey("pagesImageUpload"),
        props: {
          handlePaste: (_view, event) => {
            if (!editor.isEditable) return false;
            const onUploadFile = getOnUploadFile();
            if (!onUploadFile) return false;

            const files = collectClipboardFiles(event.clipboardData);
            if (files.length === 0) return false;

            event.preventDefault();
            void uploadAndInsertFiles(editor, files, onUploadFile);
            return true;
          },
          handleDrop: (view, event, _slice, moved) => {
            if (moved || !editor.isEditable) return false;
            const onUploadFile = getOnUploadFile();
            if (!onUploadFile) return false;

            const files = Array.from(event.dataTransfer?.files ?? []);
            if (files.length === 0) return false;

            event.preventDefault();
            const coords = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            void uploadAndInsertFiles(editor, files, onUploadFile, coords?.pos);
            return true;
          },
        },
      }),
    ];
  },
});
