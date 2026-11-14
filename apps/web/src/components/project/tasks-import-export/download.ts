import type { TaskTransferDocument } from "@/lib/task-transfer/types";

export function downloadTaskTransferDocument(
  transfer: TaskTransferDocument,
): void {
  const blob = new Blob([JSON.stringify(transfer, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `${transfer.project.slug}-tasks-export.json`);
}

/**
 * Download an already-serialized transfer as the same kind of file the plain
 * export produced — extension and naming unchanged. Used by the encrypted
 * path, whose file text comes from the seal step, not the serializer.
 */
export function downloadTaskTransferText(
  text: string,
  projectSlug: string,
): void {
  const blob = new Blob([text], { type: "application/json" });
  triggerDownload(blob, `${projectSlug}-tasks-export.json`);
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  globalThis.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
