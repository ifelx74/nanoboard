import type { JSONContent } from "@tiptap/core";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/db/db";
import { i18n } from "@/lib/i18n";
import {
  downloadPageMarkdown,
  type PageExportScope,
} from "@/lib/pages/export-page";
import { sanitizeMarkdownFileName } from "@/lib/pages/markdown";
import { toast } from "@/lib/toast";

export type ExportPageModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  pageTitle: string;
  getContentJson: () => JSONContent | null | undefined;
};

/**
 * Lazy-loaded compact Markdown `.md` export modal matching Plane's Export
 * dialog: lets the user choose `"Everything"` (external URLs + inline base64
 * data URLs for local `pageAssets`) vs `"No images"` and downloads
 * `<sanitized-title>.md`.
 */
export function ExportPageModal({
  open,
  onOpenChange,
  pageId,
  pageTitle,
  getContentJson,
}: ExportPageModalProps) {
  const { t } = useTranslation("pages");
  const [scope, setScope] = useState<PageExportScope>("everything");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setScope("everything");
      setIsExporting(false);
    }
  }, [open, pageId]);

  const fileName = sanitizeMarkdownFileName(pageTitle);

  const scopeItems: { value: PageExportScope; label: string }[] = [
    { value: "everything", label: t("export.scopeEverything") },
    { value: "no-images", label: t("export.scopeNoImages") },
  ];

  const selectedLabel =
    scope === "no-images"
      ? t("export.scopeNoImages")
      : t("export.scopeEverything");

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const downloadedFileName = await downloadPageMarkdown(db, {
        pageId,
        title: pageTitle,
        contentJson: getContentJson(),
        scope,
      });
      const successMessage = i18n.t("pages:export.success", {
        fileName: downloadedFileName,
      });
      toast.success(successMessage);
      onOpenChange(false);
    } catch (error) {
      const fallbackError = i18n.t("pages:export.failed");
      toast.error(error instanceof Error ? error.message : fallbackError);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{t("export.title")}</DialogTitle>
          <DialogDescription>{t("export.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-5">
          <div className="flex items-center justify-between gap-4">
            <label
              htmlFor="page-export-scope"
              className="text-sm font-medium text-foreground"
            >
              {t("export.includeContent")}
            </label>
            <Select
              items={scopeItems}
              value={scope}
              onValueChange={(value) => {
                if (value === "everything" || value === "no-images") {
                  setScope(value);
                }
              }}
              disabled={isExporting}
            >
              <SelectTrigger
                id="page-export-scope"
                size="sm"
                className="w-40 rounded-sm"
              >
                <SelectValue>{selectedLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent
                align="end"
                alignItemWithTrigger={false}
                className="rounded-sm"
              >
                <SelectGroup>
                  {scopeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs">
            <span className="shrink-0 text-muted-foreground">
              {t("export.fileNameLabel")}
            </span>
            <span
              className="min-w-0 truncate font-mono text-foreground"
              title={fileName}
            >
              {fileName}
            </span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExporting}
              >
                {t("export.cancel")}
              </Button>
            }
          />
          <Button
            type="button"
            size="sm"
            disabled={isExporting}
            onClick={() => void handleExport()}
          >
            <Download className="size-3.5" aria-hidden="true" />
            {isExporting ? t("export.exporting") : t("export.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportPageModal;
