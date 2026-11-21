import { describe, expect, it } from "vitest";
import {
  isDangerousLinkHref,
  isSafeLinkHref,
  normalizeLinkHref,
  truncateLinkDisplay,
} from "./links";

describe("pages link validation and normalization", () => {
  it("allows http, https, and mailto protocols", () => {
    expect(isSafeLinkHref("https://example.com/docs?q=1#top")).toBe(true);
    expect(isSafeLinkHref("http://localhost:5173/project/1")).toBe(true);
    expect(isSafeLinkHref("mailto:team@example.com")).toBe(true);
  });

  it("blocks javascript, data, vbscript, and control-character obfuscated protocols", () => {
    const malicious = [
      "javascript:alert(1)",
      "JAVASCRIPT:void(0)",
      "  javascript:alert(1)",
      "\tjavascript:alert(1)",
      "java\nscript:alert(1)",
      "java\r\nscript:alert(1)",
      "\u0001javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "  DATA:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://example.com/123",
      "ftp://files.example.com",
    ];

    for (const url of malicious) {
      expect(isSafeLinkHref(url), `should reject ${JSON.stringify(url)}`).toBe(
        false,
      );
      expect(
        normalizeLinkHref(url),
        `normalize should reject ${JSON.stringify(url)}`,
      ).toBeNull();
    }

    expect(isDangerousLinkHref("\tjava\nscript:alert(1)")).toBe(true);
    expect(isDangerousLinkHref("data:text/html,hi")).toBe(true);
    expect(isDangerousLinkHref("vbscript:foo")).toBe(true);
    expect(isDangerousLinkHref("https://example.com")).toBe(false);
  });

  it("normalizes bare domains with https:// and preserves valid schemes", () => {
    expect(normalizeLinkHref("  example.com/path ")).toBe(
      "https://example.com/path",
    );
    expect(normalizeLinkHref("docs.plane.so/pages?tab=all#intro")).toBe(
      "https://docs.plane.so/pages?tab=all#intro",
    );
    expect(normalizeLinkHref("http://localhost:5173")).toBe(
      "http://localhost:5173",
    );
    expect(normalizeLinkHref("https://nanoboard.local")).toBe(
      "https://nanoboard.local",
    );
    expect(normalizeLinkHref("mailto:hello@example.com")).toBe(
      "mailto:hello@example.com",
    );
  });

  it("rejects empty, whitespace, and malformed non-URL inputs", () => {
    expect(normalizeLinkHref("")).toBeNull();
    expect(normalizeLinkHref("   ")).toBeNull();
    expect(normalizeLinkHref("not a url")).toBeNull();
    expect(normalizeLinkHref("singleword")).toBeNull();
    expect(normalizeLinkHref("https://")).toBeNull();
    expect(normalizeLinkHref("mailto:")).toBeNull();
    expect(normalizeLinkHref("customproto://foo")).toBeNull();
  });

  it("truncates long URLs for the hover preview card", () => {
    expect(truncateLinkDisplay("https://example.com")).toBe(
      "https://example.com",
    );
    const exact40 = "https://example.com/12345678901234567890";
    expect(exact40).toHaveLength(40);
    expect(truncateLinkDisplay(exact40)).toBe(exact40);
    expect(truncateLinkDisplay(`${exact40}extra`)).toBe(`${exact40}…`);
    expect(truncateLinkDisplay("https://example.com/abcdef", 15)).toBe(
      "https://example…",
    );
  });
});
