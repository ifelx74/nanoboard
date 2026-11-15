# 0006 — Tests run in plain Node with fake-indexeddb, not the app build chain

- Status: accepted

## Context

The data layer is the heart of nanoboard and most bugs of consequence live
there. Tests must exercise the real Dexie code paths (schema, migrations,
transactions, uniqueness) without a browser, and must not be hostage to
Vite/plugin quirks or DOM-only APIs.

## Decision

- Vitest runs in a plain Node environment. IndexedDB is replaced by
  `fake-indexeddb`, wired through the helper in `src/lib/db/test-db.ts`.
- The Vitest configuration deliberately does **not** reuse
  `vite.config.ts`; the app build chain (PWA plugin, router plugin,
  Tailwind) never loads in tests.
- Tests start from an empty database: the demo-workspace seeding in Dexie's
  `populate` is gated off when `import.meta.env.MODE === "test"`.
- Functions that need isolation take a `NanoboardDB` instance as a
  parameter; the production singleton is only for production callers.

## Consequences

- Fast, deterministic, DOM-free unit/integration tests of schema,
  migrations, and invariants (uniqueness, archive eligibility, backup
  compatibility policy).
- Component-level/UI testing is out of scope by construction — test the
  data layer and pure logic there; UI remains manually verified.
- No DOM-dependent test helpers may sneak into `src/lib/db/` tests.
