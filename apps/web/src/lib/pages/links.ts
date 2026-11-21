const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const BLOCKED_LINK_PROTOCOLS = [
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "blob:",
  "about:",
] as const;

const SCHEME_PREFIX_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const LOCALHOST_HOST_RE = /^localhost(?::\d+)?(?:[/?#]|$)/i;

/**
 * Replicates WHATWG URL preprocessing: removes ASCII Tab/LF/CR anywhere in the
 * string and strips leading/trailing C0 control characters and whitespace so
 * obfuscated schemes like `"\tjava\nscript:alert(1)"` cannot bypass checks.
 */
function preprocessRawHref(raw: string): string {
  const withoutTabsAndNewlines = raw.replace(/[\t\n\r]/g, "");
  let start = 0;
  let end = withoutTabsAndNewlines.length;

  while (start < end) {
    const code = withoutTabsAndNewlines.charCodeAt(start);
    if (code <= 0x20) {
      start += 1;
    } else {
      break;
    }
  }

  while (end > start) {
    const code = withoutTabsAndNewlines.charCodeAt(end - 1);
    if (code <= 0x20) {
      end -= 1;
    } else {
      break;
    }
  }

  return withoutTabsAndNewlines.slice(start, end);
}

export function isValidHttpHostname(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost") return true;
  if (hostname.startsWith(".") || hostname.endsWith(".")) return false;
  return hostname.includes(".");
}

function isValidParsedSafeUrl(parsed: URL): boolean {
  if (!ALLOWED_LINK_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }

  if (parsed.protocol === "mailto:") {
    return parsed.pathname.trim().length > 0;
  }

  return isValidHttpHostname(parsed.hostname);
}

/**
 * Returns `true` when `rawHref` uses a dangerous/executable protocol after
 * WHATWG whitespace and C0-control normalization.
 */
export function isDangerousLinkHref(rawHref: string): boolean {
  const normalized = preprocessRawHref(rawHref).toLowerCase();
  return BLOCKED_LINK_PROTOCOLS.some((protocol) =>
    normalized.startsWith(protocol),
  );
}

/**
 * Strict safe-protocol check for existing href attributes, autolinks, and
 * pasted links. Allows only valid `http:`, `https:`, and `mailto:` URLs.
 */
export function isSafeLinkHref(rawHref: string): boolean {
  const cleaned = preprocessRawHref(rawHref);
  if (!cleaned || /\s/.test(cleaned) || isDangerousLinkHref(cleaned)) {
    return false;
  }

  try {
    const parsed = new URL(cleaned);
    return isValidParsedSafeUrl(parsed);
  } catch {
    return false;
  }
}

/**
 * Normalizes user-typed or pasted URLs for links: trims and strips control
 * characters, prepends `https://` for bare domains (e.g. `example.com/docs`),
 * and rejects dangerous or invalid URLs by returning `null`.
 */
export function normalizeLinkHref(rawHref: string): string | null {
  const cleaned = preprocessRawHref(rawHref);
  if (!cleaned || /\s/.test(cleaned) || isDangerousLinkHref(cleaned)) {
    return null;
  }

  const hasExplicitScheme =
    SCHEME_PREFIX_RE.test(cleaned) && !LOCALHOST_HOST_RE.test(cleaned);
  const candidate = hasExplicitScheme ? cleaned : `https://${cleaned}`;

  try {
    const parsed = new URL(candidate);
    if (!isValidParsedSafeUrl(parsed)) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

/**
 * Truncates long URLs for the hover preview popover without overflowing.
 */
export function truncateLinkDisplay(url: string, maxLength = 40): string {
  if (url.length <= maxLength) return url;
  return `${url.slice(0, maxLength)}…`;
}
