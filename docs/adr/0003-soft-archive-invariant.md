# 0003 — Soft-archive via `archivedAt`, eligibility enforced at the data layer

- Status: accepted

## Context

Completed tasks accumulate and drown the board. Users need to archive them
without losing them, and without a separate "deleted" table or destructive
migration. Archive rules also interact with export (transfer/backup must see
archived rows; views must not).

## Decision

- Archiving stamps `archivedAt` on the task (epoch ms). Active = stamp
  absent. There is no separate archive table and no flag on the column.
- Only tasks in a **final column** (`isFinal: true`) may be archived; the
  eligibility check is a **data-layer invariant** (`archiveTask` throws
  otherwise), never UI-only.
- All reads exclude archived tasks by default; `includeArchived: true` is
  the explicit opt-in, used only by transfer/export paths.
- Restore re-inserts in place (original column and position). A bulk
  "Archive completed tasks" sweep exists.
- `isTaskArchived` is the single shared predicate; archive decisions never
  scatter ad-hoc conditions.

## Consequences

- Any view that forgets the default exclusion shows archived tasks — the
  data-layer default is the guardrail; views keep no local archive state.
- Archived tasks keep their numbers and positions; restore is cheap and
  lossless.
- `archivedAt` is an unindexed optional prop, so it required no schema
  bump — consistent with the "unindexed optionals don't migrate" rule.
