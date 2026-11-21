import {
  NodeViewWrapper,
  useEditorState,
  type NodeViewProps,
} from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ChevronDown,
  Download,
  Image as ImageIcon,
  ImageOff,
  Link2,
  Loader2,
  Maximize2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PAGE_IMAGE_DEFAULT_WIDTH,
  PAGE_IMAGE_MIN_WIDTH_PX,
  getPageImageAnchorId,
  isPageImageAlignment,
  type PageImageAlignment,
  type PageImageExtensionOptions,
} from "@/lib/pages/extensions/image-node";
import { downloadPageImage } from "@/lib/pages/image-download";
import {
  PAGE_IMAGE_ACCEPT_ATTRIBUTE,
  deriveExternalImageFileName,
  validateExternalImageUrl,
} from "@/lib/pages/image-upload";
import { cn } from "@/lib/utils";
import {
  useOptionalPageAssetUrlCache,
  usePageAssetUrl,
} from "./page-asset-url-context";

type PlaceholderMode = "upload" | "url";

function AlignmentIcon({
  alignment,
  className,
}: {
  alignment: PageImageAlignment;
  className?: string;
}) {
  if (alignment === "center") {
    return <AlignCenter className={className} aria-hidden="true" />;
  }
  if (alignment === "right") {
    return <AlignRight className={className} aria-hidden="true" />;
  }
  return <AlignLeft className={className} aria-hidden="true" />;
}

/**
 * Custom TipTap React NodeView for Pages `image` blocks.
 * - Pending state: dashed Upload dropzone / External `http(s)` URL switcher.
 * - Populated state: shared page ObjectURL resolution, corner drag-resize
 *   preserving aspect ratio, left/center/right alignment, hover action bar
 *   (Download, Alignment, Fullscreen lightbox), stable `#image-<id>` anchor,
 *   and strict read-only enforcement on locked/archived pages.
 */
export function PageImageNodeView({
  editor,
  node,
  extension,
  selected,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const { t } = useTranslation("pages");
  const isEditable = useEditorState({
    editor,
    selector: ({ editor: e }) => e.isEditable,
  });
  const cache = useOptionalPageAssetUrlCache();
  const options = extension.options as PageImageExtensionOptions;

  const nodeId =
    typeof node.attrs.id === "string" && node.attrs.id.length > 0
      ? node.attrs.id
      : null;
  const assetId =
    typeof node.attrs.assetId === "string" && node.attrs.assetId.length > 0
      ? node.attrs.assetId
      : null;
  const rawSrc =
    typeof node.attrs.src === "string" && node.attrs.src.length > 0
      ? node.attrs.src
      : null;
  const safeExternalSrc = rawSrc ? validateExternalImageUrl(rawSrc) : null;
  const alignment: PageImageAlignment = isPageImageAlignment(
    node.attrs.alignment,
  )
    ? node.attrs.alignment
    : "left";
  const persistedWidth =
    typeof node.attrs.width === "string" && node.attrs.width.length > 0
      ? node.attrs.width
      : PAGE_IMAGE_DEFAULT_WIDTH;
  const displayName =
    (typeof node.attrs.name === "string" && node.attrs.name) ||
    (typeof node.attrs.alt === "string" && node.attrs.alt) ||
    (safeExternalSrc ? deriveExternalImageFileName(safeExternalSrc) : "image");
  const altText =
    typeof node.attrs.alt === "string" && node.attrs.alt
      ? node.attrs.alt
      : displayName;

  const isPending = !assetId && !rawSrc;

  // Placeholder state (when inserted empty via /image or toolbar button)
  const [mode, setMode] = useState<PlaceholderMode>("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Populated image state
  const localAsset = usePageAssetUrl(assetId);
  const [externalError, setExternalError] = useState(false);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [liveWidth, setLiveWidth] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const figureRef = useRef<HTMLDivElement | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setExternalError(false);
  }, [rawSrc, assetId]);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
    };
  }, []);

  const handleUploadLocalFile = useCallback(
    async (file: File) => {
      if (!isEditable || !options.onUploadFile) return;
      setIsUploading(true);
      try {
        const result = await options.onUploadFile(file);
        if (!result) return;
        updateAttributes({
          assetId: result.assetId,
          src: null,
          name: result.name,
          alt: result.name,
          width: persistedWidth || PAGE_IMAGE_DEFAULT_WIDTH,
          alignment,
          aspectRatio: result.aspectRatio,
        });
      } finally {
        setIsUploading(false);
      }
    },
    [isEditable, options, updateAttributes, persistedWidth, alignment],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) {
        void handleUploadLocalFile(file);
      }
    },
    [handleUploadLocalFile],
  );

  const handlePlaceholderDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      if (!isEditable || isUploading) return;
      const file = event.dataTransfer.files?.[0];
      if (file) {
        void handleUploadLocalFile(file);
      }
    },
    [isEditable, isUploading, handleUploadLocalFile],
  );

  const handleSubmitUrl = useCallback(() => {
    if (!isEditable) return;
    const valid = validateExternalImageUrl(urlInput);
    if (!valid) {
      setUrlError(true);
      return;
    }
    const derivedName = deriveExternalImageFileName(valid);
    updateAttributes({
      assetId: null,
      src: valid,
      name: derivedName,
      alt: derivedName,
      width: persistedWidth || PAGE_IMAGE_DEFAULT_WIDTH,
      alignment,
      aspectRatio: null,
    });
    setUrlError(false);
  }, [isEditable, urlInput, updateAttributes, persistedWidth, alignment]);

  const handleStartResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isEditable) return;
      event.preventDefault();
      event.stopPropagation();

      const containerEl = containerRef.current;
      const figureEl = figureRef.current;
      if (!containerEl || !figureEl) return;

      const containerWidth = containerEl.getBoundingClientRect().width;
      const startWidth = figureEl.getBoundingClientRect().width;
      if (containerWidth <= 0 || startWidth <= 0) return;

      const startX = event.clientX;
      const minPx = Math.min(PAGE_IMAGE_MIN_WIDTH_PX, containerWidth);
      let latestWidthStr = `${Math.max(1, Math.min(100, Math.round((startWidth / containerWidth) * 100)))}%`;

      setIsResizing(true);
      setLiveWidth(latestWidthStr);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const rawDelta = moveEvent.clientX - startX;
        let effectiveDelta = rawDelta;
        if (alignment === "right") {
          effectiveDelta = -rawDelta;
        } else if (alignment === "center") {
          effectiveDelta = rawDelta * 2;
        }
        const nextPx = Math.max(
          minPx,
          Math.min(containerWidth, startWidth + effectiveDelta),
        );
        const nextPct = Math.max(
          1,
          Math.min(100, Math.round((nextPx / containerWidth) * 100)),
        );
        latestWidthStr = `${nextPct}%`;
        setLiveWidth(latestWidthStr);
      };

      const finishResize = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", finishResize);
        window.removeEventListener("pointercancel", finishResize);
        resizeCleanupRef.current = null;
        setIsResizing(false);
        setLiveWidth(null);
        updateAttributes({ width: latestWidthStr });
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", finishResize);
      window.addEventListener("pointercancel", finishResize);
      resizeCleanupRef.current = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", finishResize);
        window.removeEventListener("pointercancel", finishResize);
      };
    },
    [isEditable, alignment, updateAttributes],
  );

  const handleOpenLightbox = useCallback(() => {
    options.onOpenLightbox?.({
      assetId,
      src: safeExternalSrc,
      name: displayName,
      alt: altText,
    });
  }, [options, assetId, safeExternalSrc, displayName, altText]);

  const wrapperAnchorProps = {
    id: nodeId ? getPageImageAnchorId(nodeId) : undefined,
    "data-id": nodeId ?? undefined,
    "data-type": "page-image",
  };

  // Pending upload / URL placeholder state
  if (isPending) {
    if (!isEditable) {
      return (
        <NodeViewWrapper
          {...wrapperAnchorProps}
          className="nb-page-image-block my-2"
        />
      );
    }

    return (
      <NodeViewWrapper
        {...wrapperAnchorProps}
        contentEditable={false}
        className="nb-page-image-block my-3 select-none"
      >
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.currentTarget === event.target) {
              setIsDragOver(false);
            }
          }}
          onDrop={handlePlaceholderDrop}
          className={cn(
            "rounded-lg border border-dashed bg-muted/40 p-3 transition-colors",
            isDragOver
              ? "border-brand-800 bg-brand-100/20 dark:bg-brand-900/20"
              : selected
                ? "border-brand-800"
                : "border-border",
          )}
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label={t("image.sourceTabsAriaLabel")}
              className="inline-flex items-center gap-1 rounded-md bg-muted/80 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "upload"}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setMode("upload");
                  setUrlError(false);
                }}
                className={cn(
                  "inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs font-medium transition-colors",
                  mode === "upload"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Upload className="size-3" aria-hidden="true" />
                <span>{t("image.uploadTab")}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "url"}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setMode("url");
                }}
                className={cn(
                  "inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs font-medium transition-colors",
                  mode === "url"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Link2 className="size-3" aria-hidden="true" />
                <span>{t("image.embedUrlTab")}</span>
              </button>
            </div>

            <button
              type="button"
              aria-label={t("image.removePlaceholder")}
              title={t("image.removePlaceholder")}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                deleteNode();
              }}
              className="grid size-6 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {mode === "upload" ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={PAGE_IMAGE_ACCEPT_ATTRIBUTE}
                onChange={handleFileInputChange}
                className="hidden"
                tabIndex={-1}
              />
              <button
                type="button"
                disabled={isUploading}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/50 disabled:cursor-wait disabled:opacity-70"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background text-muted-foreground shadow-2xs ring-1 ring-border">
                  {isUploading ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ImageIcon className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {isUploading
                      ? t("image.uploading")
                      : isDragOver
                        ? t("image.dropHere")
                        : t("image.addPrompt")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("image.uploadHint")}
                  </span>
                </span>
              </button>
            </>
          ) : (
            <div
              className="space-y-1.5"
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmitUrl();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  deleteNode();
                }
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  autoFocus
                  value={urlInput}
                  aria-label={t("image.urlInputLabel")}
                  placeholder={t("image.urlPlaceholder")}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    setUrlInput(event.target.value);
                    setUrlError(false);
                  }}
                  className={cn(
                    "h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    urlError ? "border-destructive" : "border-input",
                  )}
                />
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSubmitUrl();
                  }}
                  className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {t("image.embedButton")}
                </button>
              </div>
              {urlError && (
                <p className="text-[11px] text-destructive">
                  {t("image.errors.invalidUrl")}
                </p>
              )}
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  // Populated image state
  const resolvedSrc = assetId ? localAsset.url : safeExternalSrc;
  const isLoadingLocal = Boolean(assetId && localAsset.loading);
  const isBroken = Boolean(
    (assetId && localAsset.missing) ||
    (!assetId && !safeExternalSrc) ||
    externalError,
  );

  const alignmentClass =
    alignment === "center"
      ? "justify-center"
      : alignment === "right"
        ? "justify-end"
        : "justify-start";

  const activeWidth = liveWidth ?? persistedWidth;
  const alignmentItems: {
    key: PageImageAlignment;
    label: string;
  }[] = [
    { key: "left", label: t("image.alignLeft") },
    { key: "center", label: t("image.alignCenter") },
    { key: "right", label: t("image.alignRight") },
  ];

  return (
    <NodeViewWrapper
      {...wrapperAnchorProps}
      contentEditable={false}
      className="nb-page-image-block my-3"
    >
      <div ref={containerRef} className={cn("flex w-full", alignmentClass)}>
        <div
          ref={figureRef}
          style={{
            width: activeWidth,
            minWidth: `${PAGE_IMAGE_MIN_WIDTH_PX}px`,
          }}
          className={cn(
            "group/image-component relative max-w-full rounded-md transition-shadow",
            selected &&
              isEditable &&
              "ring-2 ring-brand-800 ring-offset-2 ring-offset-background",
          )}
        >
          {isLoadingLocal ? (
            <div
              aria-busy="true"
              className="flex aspect-video w-full animate-pulse items-center justify-center rounded-md bg-muted text-muted-foreground"
            >
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            </div>
          ) : isBroken || !resolvedSrc ? (
            <div className="flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              <ImageOff className="size-5" aria-hidden="true" />
              <span>{t("image.missing")}</span>
            </div>
          ) : (
            <img
              src={resolvedSrc}
              alt={altText}
              draggable={false}
              onDoubleClick={handleOpenLightbox}
              onError={() => {
                if (!assetId) {
                  setExternalError(true);
                }
              }}
              className="block h-auto w-full rounded-md select-none"
            />
          )}

          {/* Hover action bar: Download & Fullscreen remain active in read-only mode */}
          {!isLoadingLocal && !isBroken && resolvedSrc && (
            <div
              className={cn(
                "absolute top-2 right-2 z-20 flex h-7 items-center gap-0.5 rounded-sm bg-black/80 px-1 text-white/90 shadow-sm backdrop-blur-xs transition-opacity duration-150 focus-within:opacity-100 group-hover/image-component:opacity-100",
                alignMenuOpen || isResizing ? "opacity-100" : "opacity-0",
              )}
            >
              <button
                type="button"
                title={t("image.download")}
                aria-label={t("image.download")}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  void downloadPageImage(cache, {
                    assetId,
                    src: safeExternalSrc,
                    name: displayName,
                  });
                }}
                className="grid size-6 cursor-pointer place-items-center rounded-xs text-white/85 transition-colors hover:bg-white/15 hover:text-white"
              >
                <Download className="size-3.5" aria-hidden="true" />
              </button>

              {isEditable && (
                <DropdownMenu
                  open={alignMenuOpen}
                  onOpenChange={setAlignMenuOpen}
                >
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        title={t("image.alignment")}
                        aria-label={t("image.alignment")}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex h-6 cursor-pointer items-center gap-0.5 rounded-xs px-1 text-white/85 transition-colors hover:bg-white/15 hover:text-white"
                      >
                        <AlignmentIcon
                          alignment={alignment}
                          className="size-3.5"
                        />
                        <ChevronDown className="size-3" aria-hidden="true" />
                      </button>
                    }
                  />
                  <DropdownMenuContent
                    align="end"
                    side="bottom"
                    className="w-36"
                  >
                    {alignmentItems.map((item) => (
                      <DropdownMenuItem
                        key={item.key}
                        onClick={() =>
                          updateAttributes({ alignment: item.key })
                        }
                        className="justify-between text-xs"
                      >
                        <span className="flex items-center gap-2">
                          <AlignmentIcon
                            alignment={item.key}
                            className="size-3.5 text-muted-foreground"
                          />
                          <span>{item.label}</span>
                        </span>
                        {alignment === item.key && (
                          <Check
                            className="size-3.5 text-brand-800"
                            aria-hidden="true"
                          />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <button
                type="button"
                title={t("image.fullscreen")}
                aria-label={t("image.fullscreen")}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenLightbox();
                }}
                className="grid size-6 cursor-pointer place-items-center rounded-xs text-white/85 transition-colors hover:bg-white/15 hover:text-white"
              >
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Live percentage indicator while actively drag-resizing */}
          {isResizing && liveWidth && (
            <div className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-xs bg-black/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white">
              {liveWidth}
            </div>
          )}

          {/* Corner drag-resize handle (editable mode only; preserves aspect ratio) */}
          {isEditable && !isLoadingLocal && !isBroken && resolvedSrc && (
            <button
              type="button"
              aria-label={t("image.resizeHandle")}
              title={t("image.resizeHandle")}
              onPointerDown={handleStartResize}
              className={cn(
                "absolute -bottom-2 z-20 size-4 rounded-full border-2 border-white bg-brand-800 shadow-sm transition-opacity duration-150 focus-visible:opacity-100 group-hover/image-component:opacity-100",
                alignment === "right"
                  ? "-left-2 cursor-nesw-resize"
                  : "-right-2 cursor-nwse-resize",
                selected || isResizing ? "opacity-100" : "opacity-0",
              )}
            />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
