import { triggerDownload } from "@/lib/download";
import type { TaskTransferDocument } from "@/lib/task-transfer/types";

export function downloadTaskTransferDocument(
  transfer: TaskTransferDocument,
): void {
  // Plain exports stay pretty-printed — the bare interchange document is
  // untouched for existing consumers.
  triggerDownload(
    JSON.stringify(transfer, null, 2),
    `${transfer.project.slug}-tasks-export.json`,
  );
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
  triggerDownload(text, `${projectSlug}-tasks-export.json`);
}
