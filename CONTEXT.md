# nanoboard — Context

nanoboard is a minimalist, local-first space for tasks: kanban board, list,
calendar, and timeline views, an Excalidraw whiteboard, and sticky notes. There is no
server — all data lives in the browser's IndexedDB via Dexie. This file is
the glossary for the domain; use these terms (not synonyms) in issues, specs,
code, and comments. If a needed concept isn't here, that's a signal to add it
here rather than to invent new language.

## Core concepts

- **Project** — the top-level unit of organization. Owns columns, tasks,
  labels, and at most one whiteboard. Identified in the UI by its **project
  key** (the `slug` field, branded `ProjectKey`); tasks are addressed as
  `WR-1` (see **task key**).
- **Project key** — 1–5 uppercase letters/digits, first char a letter,
  globally unique (case-insensitive). Code and UI both use this term; "key"
  and "slug" refer to the same field (`WR` in `WR-1`).
- **Column** — a board lane within a project. Stable identity is the
  **`slug`** (`to-do`, etc.); the display `name` may change freely. The
  default set is backlog / to-do / in-progress / in-review / done. `isFinal`
  marks the completed column.
- **Task** — a work item in a project. Has a per-project sequential
  **`number`** and a human **task key** (`taskKey()`, e.g. `WR-1`).
  `status` mirrors the slug of its parent column and is written in sync.
- **Work surface** — any surface that shows tasks: board, list, calendar,
  timeline. "Removed from the board and every work surface" is the standard
  phrasing.
- **Reading surface** — a non-editable view of tasks. Board, List (grouped
  by status), Calendar (month grid).
- **Label** — a per-project colored tag. Assignments live in the
  **TaskLabel** join table (`&[taskId+labelId]`); re-attaching is a no-op.
- **Task resource** — a manual URL link on a task (resource type `"url"`).
  No file uploads, no external integrations.
- **Sticky** — a global, project-independent scratch note. Not attached to
  any project.
- **Whiteboard** — one freeform Excalidraw scene per project. Persisted as a
  single row holding the **scene triple** (`elements` / `appState` /
  `files`).
- **Scene triple** — the three parts of a saved whiteboard: non-deleted
  `elements`, a sanitized `appState` (durable whitelist only), and `files`
  pruned to live canvas references. Saved atomically as one row so elements
  never reference unpersisted files.
- **Whiteboard gallery** — the `/whiteboard` route; lists projects whose
  saved scene contains at least one non-deleted element. Backed by the
  **`whiteboardPreviews`** table, never by the multi-MB scene rows.
- **Preview** — a `whiteboardPreviews` row (`projectId` PK, thumbnail
  `dataUrl`). Exists if and only if the saved scene has ≥1 non-deleted
  element; written by content-ful saves, removed by emptied-canvas saves and
  on project deletion.
- **Timeline** — the per-project gantt-style work surface
  (`/project/$projectId/timeline`). Dated tasks render as status-colored
  bars on a fixed 40 logical px/day horizontal axis; undated tasks never
  render. A work surface, not a reading surface: the Timeline edits dates
  only — never text, titles, labels, or positions. Dates change by
  dragging bars to reschedule or resize them, or through the task drawer.

## Task lifecycle

- **Archive (soft-archive)** — setting the `archivedAt` stamp on a task.
  Only tasks in a **final column** (a column with `isFinal: true`) can be
  archived, enforced at the data layer. Active = stamp absent.
- **Archives** — the per-project route and UI (`/project/$projectId/archives`)
  listing soft-archived tasks. Archived tasks are excluded from the board,
  list, calendar, timeline, counts, and stats everywhere except the Archives
  route and explicitly `includeArchived` reads.
- **Restore** — re-inserting an archived task in place (its original column
  and position).
- **Sweep** — the "Archive completed tasks" bulk action.

## Data and interchange

- **Demo workspace** — the seed content fresh databases start with. Not an
  entity; seeded rows are indistinguishable from user-created ones. Wiped
  and reseeded in dev via `resetNanoboardToSeed()`.
- **Backup** — a **whole-workspace backup**: a self-describing JSON envelope
  (`format: "nanoboard-backup"`, versioned) with raw rows verbatim. Restore
  replaces everything, after a preview. For the user's own safekeeping.
- **Task transfer** — **Export/Import tasks** per project. Kaneo-compatible
  JSON interchange format; append-only, per-task outcomes, Markdown ↔ HTML
  for descriptions, `archivedAt` round-trip. For interoperability with other
  tools. Distinct from backup — do not conflate.
- **Interchange format** — the JSON layout used by task transfer
  (project metadata + tasks; ISO datetimes; `userId: null`).

## Identity and types

- **Branded string types** — `ProjectKey`, `ColumnSlug`, `DueDateString`,
  `StartDateString`. Branded at the boundary so slugs can't mix with names
  and `yyyy-mm-dd` dates never mix with epoch-ms timestamps.
- **Task key** — `taskKey(slug, number)` → e.g. `WR-1`. The human handle for
  a task; always derived, never stored.
- **cuid2** — the id format for all rows.

## Explicitly avoided terms

- **Workspace** — there is no workspace entity. It survives only in
  "whole-workspace backup" and "demo workspace" (adjectives). No workspace,
  auth, account, login, user, session, or role concepts exist.
- **Sync** — explicitly out of scope. Backup is a manual snapshot, not sync.
- **Server / cloud / backend / API** — nanoboard is local-first; "the browser
  is the database".
- **Encryption** — encrypted import/export is specced but **not
  implemented**; zero crypto code exists. Don't treat it as a feature.
- **Lane** — internal component naming only ("registerLaneRef", calendar
  lanes). Domain language is **Column**.
- **Status field** — `status` is the stored echo of the parent column's
  slug, not an independent field. Say "column" or "the task's column".
