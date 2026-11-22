import { textblockTypeInputRule } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PageCodeBlockNodeView } from "@/components/pages/editor/page-code-block-node-view";
import {
  CODE_BLOCK_FENCE_BACKTICK_REGEX,
  CODE_BLOCK_FENCE_TILDE_REGEX,
  normalizeCodeLanguage,
} from "@/lib/pages/code-blocks";
import { pagesLowlight } from "@/lib/pages/lowlight";

/**
 * Pages syntax-highlighted CodeBlock node replacing StarterKit's default
 * `codeBlock`. Uses the lazy module-level singleton `pagesLowlight` (`common`
 * + TypeScript), enables `Tab`/`Shift-Tab` indentation (2 spaces), supports
 * normalized fenced ```` ```lang ```` / `~~~lang` input rules, and renders
 * `PageCodeBlockNodeView` with GitHub Dark styling, hover language dropdown,
 * and hover copy button.
 */
export const PageCodeBlockExtension = CodeBlockLowlight.extend({
  // Above PagesListBehaviorExtension (100) so Tab indents inside code blocks
  // nested within list items; below pagesTitleBodyNavigation (1000) so ArrowUp
  // at document start returns to the Page H1 title.
  priority: 150,

  addOptions() {
    const parentOptions = this.parent?.();
    return {
      languageClassPrefix: "language-",
      exitOnTripleEnter: true,
      exitOnArrowDown: true,
      HTMLAttributes: {},
      ...parentOptions,
      lowlight: pagesLowlight,
      defaultLanguage: null,
      enableTabIndentation: true,
      tabSize: 2,
      exitOnArrowUp: false,
    };
  },

  addAttributes() {
    const parentAttrs = this.parent?.() ?? {};
    return {
      ...parentAttrs,
      language: {
        default: this.options.defaultLanguage,
        parseHTML: (element: HTMLElement) => {
          const { languageClassPrefix } = this.options;
          if (!languageClassPrefix) return null;
          const classes = [...(element.firstElementChild?.classList ?? [])];
          const raw = classes
            .filter((className) => className.startsWith(languageClassPrefix))
            .map((className) => className.slice(languageClassPrefix.length))[0];
          return normalizeCodeLanguage(raw);
        },
        rendered: false,
      },
    };
  },

  addInputRules() {
    return [
      textblockTypeInputRule({
        find: CODE_BLOCK_FENCE_BACKTICK_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          language: normalizeCodeLanguage(match[1]),
        }),
      }),
      textblockTypeInputRule({
        find: CODE_BLOCK_FENCE_TILDE_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          language: normalizeCodeLanguage(match[1]),
        }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageCodeBlockNodeView);
  },
});
