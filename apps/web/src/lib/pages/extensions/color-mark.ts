import { Mark, mergeAttributes } from "@tiptap/core";
import { isPageColorKey, type PageColorKey } from "@/lib/pages/colors";

export interface PageColorMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageColor: {
      setTextColor: (color: PageColorKey) => ReturnType;
      unsetTextColor: () => ReturnType;
      setBackgroundColor: (backgroundColor: PageColorKey) => ReturnType;
      unsetBackgroundColor: () => ReturnType;
      removeEmptyPageColor: () => ReturnType;
    };
  }
}

/**
 * Semantic 8-color foreground and background highlight mark for Pages.
 * Renders `data-text-color` and `data-background-color` attributes bound to
 * theme-adaptive CSS custom properties so colors stay legible in light & dark.
 */
export const PageColorMark = Mark.create<PageColorMarkOptions>({
  name: "pageColor",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-text-color");
          return isPageColorKey(value) ? value : null;
        },
        renderHTML: (attributes: { color?: unknown }) => {
          if (!isPageColorKey(attributes.color)) {
            return {};
          }
          return {
            "data-text-color": attributes.color,
          };
        },
      },
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-background-color");
          return isPageColorKey(value) ? value : null;
        },
        renderHTML: (attributes: { backgroundColor?: unknown }) => {
          if (!isPageColorKey(attributes.backgroundColor)) {
            return {};
          }
          return {
            "data-background-color": attributes.backgroundColor,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-text-color]",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          return isPageColorKey(node.getAttribute("data-text-color"))
            ? {}
            : false;
        },
      },
      {
        tag: "span[data-background-color]",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          return isPageColorKey(node.getAttribute("data-background-color"))
            ? {}
            : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setTextColor:
        (color: PageColorKey) =>
        ({ chain }) => {
          if (!isPageColorKey(color)) return false;
          return chain().setMark(this.name, { color }).run();
        },
      unsetTextColor:
        () =>
        ({ chain }) =>
          chain()
            .setMark(this.name, { color: null })
            .removeEmptyPageColor()
            .run(),
      setBackgroundColor:
        (backgroundColor: PageColorKey) =>
        ({ chain }) => {
          if (!isPageColorKey(backgroundColor)) return false;
          return chain().setMark(this.name, { backgroundColor }).run();
        },
      unsetBackgroundColor:
        () =>
        ({ chain }) =>
          chain()
            .setMark(this.name, { backgroundColor: null })
            .removeEmptyPageColor()
            .run(),
      removeEmptyPageColor:
        () =>
        ({ state, tr, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          const { selection } = tr;
          if (selection.empty) {
            const stored = tr.storedMarks ?? selection.$from.marks();
            const mark = stored.find((m) => m.type === markType);
            if (mark && !mark.attrs.color && !mark.attrs.backgroundColor) {
              if (dispatch) {
                tr.removeStoredMark(markType);
              }
            }
            return true;
          }

          if (dispatch) {
            for (const range of selection.ranges) {
              const from = range.$from.pos;
              const to = range.$to.pos;
              tr.doc.nodesBetween(from, to, (node, pos) => {
                if (!node.isText) return;
                const emptyMark = node.marks.find(
                  (m) =>
                    m.type === markType &&
                    !m.attrs.color &&
                    !m.attrs.backgroundColor,
                );
                if (emptyMark) {
                  tr.removeMark(
                    Math.max(pos, from),
                    Math.min(pos + node.nodeSize, to),
                    markType,
                  );
                }
              });
            }
          }
          return true;
        },
    };
  },
});
