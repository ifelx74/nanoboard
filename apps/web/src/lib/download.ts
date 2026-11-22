/**
 * Trigger a browser download for a binary `Blob` as `fileName`, revoking its
 * temporary object URL immediately after triggering the click.
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
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

/**
 * Trigger a browser download of `text` as `fileName`, typed as JSON.
 * Shared by the backup and task-transfer download helpers.
 */
export function triggerDownload(text: string, fileName: string): void {
  const blob = new Blob([text], { type: "application/json" });
  triggerBlobDownload(blob, fileName);
}
