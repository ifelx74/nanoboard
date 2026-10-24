/**
 * Normalize markdown before save: CRLF → LF, runs of 3+ blank lines collapse to one blank line.
 */
export function formatMarkdown(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}
