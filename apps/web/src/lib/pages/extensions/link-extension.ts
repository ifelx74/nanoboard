import { mergeAttributes } from "@tiptap/core";
import Link, { type LinkOptions } from "@tiptap/extension-link";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { isSafeLinkHref } from "@/lib/pages/links";

export interface PageLinkStorage {
  isBubbleMenuOpen: boolean;
  isPreviewOpen: boolean;
}

/**
 * Hardened Pages Link extension replacing StarterKit's bundled `link` mark.
 * Supports autolink, paste-URL-onto-selection, strict safe-protocol filtering
 * (`http:`, `https:`, `mailto:`), safe new-tab opening on click, and shared
 * storage flags so Bubble Menu and Link Hover Preview coordinate cleanly.
 */
export const PageLinkExtension = Link.extend<LinkOptions, PageLinkStorage>({
  inclusive: false,

  addStorage() {
    return {
      isBubbleMenuOpen: false,
      isPreviewOpen: false,
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[href]",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          const href = node.getAttribute("href") ?? "";
          return isSafeLinkHref(href) ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const href =
      typeof HTMLAttributes.href === "string" ? HTMLAttributes.href : "";
    if (!isSafeLinkHref(href)) {
      return [
        "a",
        mergeAttributes(this.options.HTMLAttributes, {
          ...HTMLAttributes,
          href: undefined,
        }),
        0,
      ];
    }
    return [
      "a",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];

    const safeClickPlugin = new Plugin({
      key: new PluginKey("pagesSafeLinkClick"),
      props: {
        handleClick(_view, _pos, event) {
          if (event.button !== 0) return false;
          const target = event.target as HTMLElement | null;
          const anchor = target?.closest("a");
          if (!anchor) return false;

          const href = anchor.getAttribute("href") ?? "";
          if (!isSafeLinkHref(href)) {
            event.preventDefault();
            return true;
          }

          window.open(href, "_blank", "noopener,noreferrer");
          return true;
        },
      },
    });

    return [...parentPlugins, safeClickPlugin];
  },
}).configure({
  autolink: true,
  linkOnPaste: true,
  openOnClick: false,
  defaultProtocol: "https",
  protocols: ["http", "https", "mailto"],
  isAllowedUri: (url) => isSafeLinkHref(url),
  shouldAutoLink: (url) => isSafeLinkHref(url),
  HTMLAttributes: {
    target: "_blank",
    rel: "noopener noreferrer nofollow",
  },
});
