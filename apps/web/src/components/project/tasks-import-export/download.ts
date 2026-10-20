import type { TaskTransferDocument } from "@/lib/task-transfer/types";

export function downloadTaskTransferDocument(
  transfer: TaskTransferDocument,
): void {
  const blob = new Blob([JSON.stringify(transfer, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = `${transfer.project.slug}-tasks-export.json`;
  anchor.style.display = "none";
  globalThis.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
