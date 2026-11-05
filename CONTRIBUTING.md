# Contributing to nanoboard

Thanks for your interest in contributing! This guide covers local setup, development commands, project conventions, and how to land a change.

## Prerequisites

- **Node.js ≥ 24.20** — required by the root `engines` field.
- **pnpm 11.24.0** — pinned in `package.json`. Enable it with [Corepack](https://nodejs.org/api/corepack.html) if it is not already available:

```bash
corepack enable
```

## Getting started

```bash
git clone https://github.com/ifelx74/nanoboard.git
cd nanoboard
pnpm install
```

## Development

```bash
pnpm dev
```

This starts the Vite dev server at [http://localhost:5173](http://localhost:5173).

The app is local-first: data lives in the browser's IndexedDB through Dexie. Fresh databases are seeded with a demo workspace so first-time visitors can explore the app. To wipe and reseed it from the browser console (dev server only), run:

```js
await resetNanoboardToSeed();
```

## Commands

Run these from the repository root:

| Command       | Description                                               |
| ------------- | --------------------------------------------------------- |
| `pnpm dev`    | Start the Vite dev server.                                |
| `pnpm build`  | Typecheck with `tsc`, then build the web app with Vite.   |
| `pnpm lint`   | Run ESLint across the workspace.                          |
| `pnpm test`   | Run all Vitest suites.                                    |
| `pnpm format` | Format TypeScript, TSX, and Markdown files with Prettier. |

There is no separate `typecheck` script; `pnpm build` runs TypeScript first. To run only the web app's tests:

```bash
pnpm --filter web test
```

## Project layout

- `apps/web/` — the only app: React 19, Vite, TanStack Router, Tailwind CSS 4, PWA.
  - `src/routes/` — TanStack Router file-based routes. `src/routeTree.gen.ts` is generated; never edit it by hand.
  - `src/lib/db/` — the Dexie data layer. All reads and writes go through here.
  - `src/lib/editor/` — TipTap rich text.
  - `src/lib/backup/` — export/import.
  - `src/components/` — feature components and shadcn/ui primitives.
  - `src/store/` — Zustand stores.
- `packages/` — shared ESLint and TypeScript config.
- `docs/agents/` — notes for agent workflows (issue tracker and domain docs).

## Development guidelines

- **Stay local-first.** Do not add network calls or server state. Persistence belongs in `apps/web/src/lib/db/`.
- **Never edit generated files.** `apps/web/src/routeTree.gen.ts` is produced by the TanStack Router plugin.
- **Keep type safety strict.** The project enables `noUnusedLocals`, `noUnusedParameters`, and `noImplicitReturns`.
- **Tests run in Node, not a browser.** `fake-indexeddb` replaces IndexedDB via `apps/web/src/lib/db/test-db.ts`. The Vitest config intentionally does not reuse `vite.config.ts`.
- **Mind the PWA precache.** Chunks over 400 kB — the Excalidraw/whiteboard subtree — are excluded from install-time precache and served through CacheFirst runtime caching. Read the comment in `apps/web/vite.config.ts` before changing Workbox options.
- **Theme with CSS variables.** Dark mode tokens live in `apps/web/src/index.css`.

## Environment variables

No environment variables are required to run or build the app.

`VITE_APP_ENABLE_PWA=true` is optional and only enables PWA behavior in the dev server:

```bash
VITE_APP_ENABLE_PWA=true pnpm dev
```

Do not commit `.env` files; they are gitignored.

## Submitting a pull request

1. For non-trivial changes, open an issue first so the approach can be discussed.
2. Fork the repository and create a branch from `main`.
3. Keep each pull request focused on one problem. Avoid unrelated refactors or formatting-only churn.
4. Include tests and documentation updates when the change warrants them.
5. Run `pnpm lint`, `pnpm test`, and `pnpm build` before pushing.
6. Open the pull request against `main` with a clear description of the problem and solution.

Every push to `main` is built and deployed automatically to Cloudflare Pages. Maintainers handle deployment secrets; contributors do not need any.

## Reporting bugs and requesting features

Open an issue at [issues](https://github.com/ifelx74/nanoboard/issues). Include a clear description, reproduction steps, and any relevant screenshots or console output.

## License

Nanoboard is released under the [MIT License](./LICENSE). By contributing, you agree that your contributions will be licensed under the same terms.
