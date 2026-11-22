import type { AnyExtension } from "@tiptap/core";
import type { StarterKitOptions } from "@tiptap/starter-kit";
import { Table2 } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { PageCodeBlockExtension } from "@/lib/pages/extensions/code-block-extension";
import {
  createPageTableExtensions,
  insertPageTable,
} from "@/lib/pages/extensions/table-extension";
import type { PageSlashCommandAdditionalEntry } from "./page-slash-commands";

export const PAGE_CODE_TABLE_STARTER_KIT_OVERRIDES: Partial<StarterKitOptions> =
  {
    codeBlock: false,
  };

export const PAGE_CODE_TABLE_UNIQUE_ID_TYPES: readonly string[] = ["table"];

export function createPageCodeTableExtensions(): AnyExtension[] {
  return [PageCodeBlockExtension, ...createPageTableExtensions()];
}

export function createPageTableSlashCommandEntry(): PageSlashCommandAdditionalEntry {
  return {
    section: "general",
    pushAfter: "to-do-list",
    item: {
      key: "table",
      commandKey: "table",
      title: i18n.t("pages:table.slashTitle"),
      description: i18n.t("pages:table.slashDesc"),
      searchTerms: ["table", "grid", "columns", "rows", "spreadsheet"],
      icon: <Table2 className="size-3.5" aria-hidden="true" />,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        insertPageTable(editor);
      },
    },
  };
}
