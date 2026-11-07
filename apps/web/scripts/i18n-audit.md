# Hard-coded-string audit method

Companion to `i18n-report.mjs`: the static report proves translation _keys_
are consistent (nothing used is missing, nothing defined is unused, nothing
dynamic slips past the typed surface). This audit proves _extraction_ is
complete: no user-facing copy remains hard-coded in source. Run it over every
surface before declaring an extraction batch done — "extraction complete" is
a searched-for zero, not an assertion.

## What to search for

Every hit must be either extracted into `src/lib/i18n/locales/en-US.json`
under the namespace for its surface (also see `spec.md` for the namespace
set) or matched against an exclusion below. Search JSX text and rendered
string literals:

```sh
# JSX text nodes: visible copy between tags
rg -n '>[A-Za-z+][^<{]*<' apps/web/src --glob '*.tsx'

# Rendered string literals in props and expressions (labels, tooltips,
# placeholders, aria labels, toast messages, dialog copy)
rg -n '(label|tooltip|placeholder|aria-label|title|description|message|emptyTitle|emptyDescription)\s*=\s*\{?\s*"' apps/web/src --glob '*.tsx'
rg -n '(toast|notify)\.\w+\(\s*"' apps/web/src --glob '*.ts*'

# Literals handed straight to JSX children or returned as copy
rg -n '>\s*"[^"]*"' apps/web/src --glob '*.tsx'
rg -n '\{\s*"[A-Za-z][^"]*"\s*\}' apps/web/src --glob '*.tsx'
```

For each hit, ask: _can a user read this, or can assistive technology speak
it?_ If yes, extract it — a namespaced key, rendered through the translation
hook in components or the runtime singleton (`i18n.t(...)`, evaluated when
fired) in imperative code such as toasts. If a sentence needs a count, use
the `{{count}}` placeholder and plural key forms (`_one` / `_other`); the
resource-integrity test (`src/lib/i18n/en-us-resources.test.ts`) requires
plural families to be complete. Then re-run the audit and
`pnpm i18n:report` until both are clean.

## Exclusions

These hits are expected and stay as-is. Everything not on this list must be
extracted.

1. **Seeded demo content** — `src/lib/db/seed.ts` (and its test
   expectations). Demo projects, tasks, labels, and stickies are authored
   example data, not interface copy. Translating them at seed time would
   freeze one language into the database and go stale on language switch.
   User-generated content is likewise never translated.
2. **Data-layer internal errors** — thrown `Error("...")` strings in
   `src/lib/db/*.ts` and `src/lib/backup/*.ts`. These are English internal
   diagnostics, asserted by tests, never shown to users as-is; the UI
   catches them and presents a translated message at the presentation
   boundary. This keeps the data layer pure and storage-agnostic.
3. **Tests** — `*.test.ts` / `*.test.tsx` anywhere under `src/`: assertions,
   expected values, and fixture data. Test code is not UI.
4. **Non-UI constants** — anything a user never reads: storage and
   persist-envelope keys, route paths, database ids and slugs, CSS class
   names, file extensions and MIME types, date-format pattern fragments
   (formatting itself is locale-aware via the formatting module, not via
   translation keys), and other identifiers.

If a hit seems to fit an exclusion but is not covered by one of the four
above, extract it or extend this list with a reason — do not silently skip
it.
