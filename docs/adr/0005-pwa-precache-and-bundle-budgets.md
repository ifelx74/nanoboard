# 0005 — PWA precache ≤ 400 kB; lazy chunks via CacheFirst; budgets gate deploys

- Status: accepted

## Context

nanoboard ships as an installable, offline-capable PWA (vite-plugin-pwa,
`autoUpdate`). The Excalidraw subtree (~4 MB) and the lazy Pages rich-text
editor (`page-editor-workspace` + `emoji-data`, >400 kB per chunk) are heavy
route-only subtrees — installing them on first visit would punish first-time
visitors and inflate the update path for everyone. Meanwhile regressions in
initial-load size creep in silently without an enforced budget.

## Decision

- Install-time precache is capped at **400 kB per chunk**
  (`maximumFileSizeToCacheInBytes`). App-shell chunks are all under 330 kB,
  so the threshold cleanly separates them from heavy lazy feature chunks —
  the whiteboard subtree (435 kB–1.8 MB) and the lazy Pages editor
  (`page-editor-workspace` and `emoji-data`) — without naming fragile hashed
  filenames.
- The size-excluded lazy chunks are served via **CacheFirst runtime
  caching** on first fetch; offline whiteboard and Page editing work after
  their first online visit. The accepted trade: a whiteboard or Page editor
  opened offline before its first online visit can't load.
- Locale chunks (~1.2 MB, 54 chunks) are deliberately kept in the precache;
  offline locale switching is a stated goal.
- Initial-load budgets — 240 kB JS / 30 kB CSS gzip (entry + modulepreload
  - stylesheet, lazy chunks excluded) — are enforced by `check:bundle` in
    the deploy workflow; the build fails on regression. Bump limits only in a
    PR showing the trade-off is deliberate.
- `autoUpdate` activates the new worker without prompting; the precache
  updates incrementally on background service-worker checks.

## Consequences

- Users who never open a whiteboard or Page editor never download those heavy
  lazy chunks at install time.
- Budget bumps are a deliberate, reviewable act, not drift.
- If an app-shell chunk approaches 400 kB, the threshold (not the budgets)
  must be revisited — see the comment block in `apps/web/vite.config.ts`
  before touching Workbox options.
- Initial-load JS sits at 213.5 kB gzip; headroom exists but is budget-
  bounded, not unlimited.
