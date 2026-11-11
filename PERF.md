# Performance

Baseline and ledger for frontend performance work. Measure first, change one
thing at a time, re-measure; revert what doesn't beat the baseline.

## Budgets (enforced)

`apps/web` — `pnpm build && pnpm check:bundle` (script:
`apps/web/scripts/check-bundle-size.mjs`). Sums the gzip size of everything
`dist/index.html` pulls before first paint: the entry `<script>`, every
`modulepreload` chunk, and the stylesheet. Lazy chunks (whiteboard, route
code, locale packs) are not counted — they are governed by the PWA precache
policy in `apps/web/vite.config.ts`. The deploy workflow
(`.github/workflows/deploy.yml`) runs the check after the build and blocks
on failure.

| Budget                                   | Limit  | Baseline (2026-11-11) |
| ---------------------------------------- | ------ | --------------------- |
| Initial JS (gzip, entry + modulepreload) | 240 kB | 213.5 kB              |
| Initial CSS (gzip)                       | 30 kB  | 22.8 kB               |

Bump limits only in a PR that shows the trade-off is deliberate.

## Measured baseline (2026-11-11)

- Initial JS 213.5 kB / CSS 22.8 kB gzip; no TipTap, Prosemirror, Excalidraw,
  or dnd-kit on the boot path.
- PWA precache: 236 entries, 5.64 MB (54 locale chunks ≈ 1.2 MB included
  deliberately — offline locale switching). Whiteboard subtree (≥ 435 kB
  chunks, ~4 MB) excluded from install-time precache, CacheFirst at runtime.
- `getProjectsStats` (sidebar + home live queries, full `tasks`/`columns`
  scans): 12.5 ms per call at 2000 tasks × 2 KB descriptions, measured with
  fake-indexeddb. Fine under the autosave debounce; revisit only with a
  real-device INP regression.
- `getProjectTasks`: 2.4 ms per call (one project, 200 tasks).
- Kanban drag on a 200-task board (headless Firefox, drag from column 1 to
  column 2, 40 pointer steps; fresh profile + synthetic tasks per run):
  baseline worst rAF gap 203–214 ms (8–10 frames > 32 ms); after the
  `TaskCardView`/`BoardColumn` memo change, worst gap 89–110 ms with one
  152 ms outlier (4–9 frames > 32 ms), n=3 vs n=6. Card moved columns on
  every run. Remaining gap is dnd-kit's drag-start `measureDroppableContainers`
  sweep — not a React re-render cost.

Measurement harness: no browser was initially available; timings come from
headless Firefox 153 (system binary, WebDriver BiDi via puppeteer-core in a
scratch dir — not a repo dependency). Re-measure in Chrome with a real
Performance trace before treating these numbers as release-grade.

## Ledger

| Idea                                                                                           | Measured result                                                  | Verdict  | Why                                                                                                |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| Denormalize/optimize `getProjectsStats`                                                        | 12.5 ms @ scale                                                  | rejected | Within budget; needs schema v5, no measured win                                                    |
| Memoize `TaskCardView` + `BoardColumn` (element-wise tasks compare) + stable `registerLaneRef` | worst frame gap 203–214 ms → 89–110 ms; >32 ms frames 8–10 → 4–5 | kept     | dnd-kit re-renders transforms regardless; the win is skipping the card subtree in unaffected lanes |
| Lazy-load TipTap out of the board route chunk                                                  | ~130 kB gz deferred                                              | rejected | Punishes the primary interaction (opening a task)                                                  |
| Exclude locale chunks from the precache                                                        | 5.6 → ~4.4 MB install                                            | declined | Offline-first is a stated goal; kept deliberately                                                  |
| Add `check:bundle` budget + CI guard                                                           | 213.5 kB vs 240 kB budget                                        | kept     | Prevents silent initial-load regressions                                                           |
