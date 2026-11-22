import type { AnyExtension } from "@tiptap/core";
import { MessageSquare, Smile } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { PageCalloutExtension } from "./page-callout-extension";
import {
  createPageEmojiExtension,
  openInlineEmojiSuggestion,
} from "./page-emoji-extension";
import type { PageSlashCommandAdditionalEntry } from "./page-slash-commands";

export const EMOJI_CALLOUT_UNIQUE_ID_TYPES = ["callout"] as const;

/**
 * Returns Ticket 04's TipTap v3 extensions (Callout block + inline `:` Emoji
 * autocomplete) to pass into `PageEditorWorkspace`'s `extraExtensions` seam.
 */
export function createEmojiCalloutExtensions(): AnyExtension[] {
  return [PageCalloutExtension, createPageEmojiExtension()];
}

/**
 * Returns `/callout` and `/emoji` slash command entries to pass into
 * `PageEditorWorkspace`'s `extraSlashCommands` seam.
 */
export function createEmojiCalloutSlashCommands(): PageSlashCommandAdditionalEntry[] {
  const iconClass = "size-3.5";

  return [
    {
      section: "general",
      pushAfter: "code",
      item: {
        key: "callout",
        commandKey: "callout",
        title: i18n.t("pages:callout.slashTitle"),
        description: i18n.t("pages:callout.slashDescription"),
        searchTerms: [
          "callout",
          "info",
          "note",
          "alert",
          "warning",
          "tip",
          "encadre",
        ],
        icon: <MessageSquare className={iconClass} aria-hidden="true" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).insertCallout().run();
        },
      },
    },
    {
      section: "general",
      pushAfter: "divider",
      item: {
        key: "emoji",
        commandKey: "emoji",
        title: i18n.t("pages:logoPicker.slashEmojiTitle"),
        description: i18n.t("pages:logoPicker.slashEmojiDescription"),
        searchTerms: ["emoji", "smile", "icon", "reaction", "emoticon"],
        icon: <Smile className={iconClass} aria-hidden="true" />,
        command: ({ editor, range }) => {
          openInlineEmojiSuggestion(editor, range);
        },
      },
    },
  ];
}
