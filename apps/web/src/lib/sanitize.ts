import DOMPurify from "dompurify";

/**
 * Sanitize untrusted rich-text HTML — e.g. a sticky's contentHtml read back
 * from a backup file — before it reaches dangerouslySetInnerHTML. DOMPurify's
 * default allowlist covers formatting markup (headings, lists, links, code,
 * emphasis) and strips scripts, event-handler attributes, and javascript:
 * URLs. The alternative to sanitizing would be trusting the file, which is
 * exactly the case this exists for: encrypted backups are only as trustworthy
 * as the person who sent them.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}
