import type { AnyExtension } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

/**
 * Shared description extensions: StarterKit (headings 1–3,
 * no trailing node) plus task lists, placeholder, GFM markdown, and a
 * render-only image node. StarterKit v3 already bundles link and
 * underline, so they are configured — not added — to avoid duplicate
 * extension names.
 *
 * Image insertion stays disabled (uploads are deferred): with no upload
 * handler, pasted/dropped files are ignored, while external `![](url)`
 * markdown still parses and renders.
 */
export function createDescriptionExtensions(
  placeholder: string,
): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      trailingNode: false,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({
      HTMLAttributes: { class: "nb-editor-image", loading: "lazy" },
    }),
    Placeholder.configure({ placeholder }),
    Markdown.configure({ markedOptions: { breaks: true, gfm: true } }),
  ];
}
