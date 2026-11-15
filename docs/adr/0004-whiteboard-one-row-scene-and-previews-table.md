# 0004 — Whiteboard scene persisted as one row; gallery via a separate previews table

- Status: accepted

## Context

Each project has one freeform Excalidraw whiteboard. Scenes are large
(elements + binary files as data URLs) and consistency between elements and
files is required on every save. A separate gallery route (`/whiteboard`)
lists projects that have whiteboard content; reading whole scenes to answer
"does this project have a board?" would load multi-MB rows.

## Decision

- The scene is persisted as a **single row** per project: `elements`
  (non-deleted only), a sanitized `appState` (durable-key whitelist only),
  and `files` pruned to those referenced by live elements. Saving is atomic
  at the row level, so a saved scene can never reference an unpersisted
  file. The reference-implementation's split-file machinery is deliberately
  not ported.
- One whiteboard per project, enforced by a unique compound index
  `&[projectId]` (not `&projectId`) so multi-board support later widens to
  `&[projectId+name]` with no data migration.
- The gallery reads a separate **`whiteboardPreviews`** table: one row per
  project (`projectId` PK, thumbnail `dataUrl`, `updatedAt`), written only
  by content-ful saves and removed by emptied-canvas saves and project
  deletion. A preview exists if and only if the saved scene has ≥1
  non-deleted element. The gallery is a live-query "has content" index and
  never touches scene rows.

## Consequences

- Scene reads/writes are simple and atomic; no transactional multi-table
  save dance.
- On big boards, saves rewrite the whole row; acceptable at current scale
  (single-user local data) and revisitable with element-level storage only
  if profiling demands it.
- The gallery stays fast and cheap regardless of scene size.
- Emptying a canvas is a delete of the preview row — the project disappears
  from the gallery while its whiteboard data (if any non-deleted elements
  remain) is unaffected.
