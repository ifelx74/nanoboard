import {
  Mark,
  markInputRule,
  markPasteRule,
  mergeAttributes,
  type InputRuleMatch,
  type PasteRuleMatch,
} from "@tiptap/core";

export interface PageInlineCodeOptions {
  HTMLAttributes: Record<string, unknown>;
}

const backtickInputMatch = (text: string): InputRuleMatch | null => {
  const match = /`([^`]+)`(?!`)$/.exec(text);
  if (!match) return null;
  if (match.index > 0 && text[match.index - 1] === "`") return null;
  return {
    index: match.index,
    text: match[0],
    replaceWith: match[1],
  };
};

const backtickPasteMatch = (text: string): PasteRuleMatch[] => {
  const regex = /`([^`]+)`(?!`)/g;
  const matches: PasteRuleMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > 0 && text[match.index - 1] === "`") continue;
    matches.push({
      index: match.index,
      text: match[0],
      replaceWith: match[1],
    });
  }
  return matches;
};

/**
 * Plane-styled inline code mark (`Mod+E` and backticks) replacing StarterKit's
 * bundled `code` mark. Styled as an orange monospace chip with codemark cursor
 * boundary escape on ArrowRight / ArrowLeft so typing never gets trapped.
 */
export const PageInlineCodeMark = Mark.create<PageInlineCodeOptions>({
  name: "code",

  addOptions() {
    return {
      HTMLAttributes: {
        class: "nb-inline-code",
        spellcheck: "false",
      },
    };
  },

  excludes: "_",

  code: true,

  exitable: true,

  parseHTML() {
    return [{ tag: "code" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "code",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setCode:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      toggleCode:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      unsetCode:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-e": () => this.editor.commands.toggleCode(),
      ArrowRight: () => {
        const { state, view } = this.editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const codeType = state.schema.marks[this.name];
        if (!codeType) return false;

        const { $from } = selection;
        const activeMarks = state.storedMarks ?? $from.marks();
        if (!codeType.isInSet(activeMarks)) return false;

        const nodeAfter = $from.nodeAfter;
        const nextHasCode = Boolean(
          nodeAfter && codeType.isInSet(nodeAfter.marks),
        );
        if (nextHasCode) return false;

        // Cursor is at the right boundary of inline code while still inheriting
        // the code mark: exit the mark cleanly without trapping the caret.
        view.dispatch(state.tr.removeStoredMark(codeType));
        return true;
      },
      ArrowLeft: () => {
        const { state, view } = this.editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const codeType = state.schema.marks[this.name];
        if (!codeType) return false;

        const { $from } = selection;
        if ($from.parentOffset !== 0) return false;

        const activeMarks = state.storedMarks ?? $from.marks();
        const nodeAfter = $from.nodeAfter;
        const afterHasCode = Boolean(
          nodeAfter && codeType.isInSet(nodeAfter.marks),
        );
        if (codeType.isInSet(activeMarks) && afterHasCode) {
          view.dispatch(state.tr.removeStoredMark(codeType));
          return true;
        }
        return false;
      },
    };
  },

  addInputRules() {
    return [
      markInputRule({
        find: backtickInputMatch,
        type: this.type,
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: backtickPasteMatch,
        type: this.type,
      }),
    ];
  },
});
