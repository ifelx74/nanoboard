# 0001 — Local-first: the browser is the database

- Status: accepted

## Context

nanoboard is a personal productivity app: kanban board, pages, whiteboard,
calendar, and sticky notes. The requirements are privacy (data never leaves
the device), offline operation, zero-friction first run, and no accounts or
sync infrastructure to build or maintain.

## Decision

There is no server. All persistence lives in the browser's IndexedDB via
Dexie, accessed exclusively through the data layer in
`apps/web/src/lib/db/`. No network calls, no server state, no accounts.
The PWA precaches the app shell so it works fully offline (with the
documented >400 kB lazy-chunk exception for the whiteboard subtree and the
lazy Pages editor / `emoji-data` chunks — see 0005).

## Consequences

- Data is private by construction and there is nothing to deploy server-side.
- Backup/restore and per-project task transfer are the only data-interchange
  paths, both manual (see 0002).
- No multi-device sync; folder-synced exports may double as a sync artifact
  later, but sync itself is explicitly out of scope.
- Storage limits and eviction are the browser's; data loss risk is mitigated
  only by user backups.
- The demo workspace seeds fresh databases so first-time visitors see a
  working app; tests gate seeding off and always start empty.
