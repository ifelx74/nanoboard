# 0002 — Two distinct export formats: backup vs task transfer

- Status: accepted

## Context

Users need two different things from "export": their own data back for safe
keeping, and interoperability with other task tools. A single format that
serves both would either leak internal row shape into a public interchange
contract, or lose fidelity (IDs, positions, whiteboard scenes) for backups.

## Decision

Two deliberately separate formats:

- **Backup** — whole-workspace snapshot. Self-describing envelope
  (`format: "nanoboard-backup"`, `BACKUP_FORMAT_VERSION = 1`), raw rows
  verbatim (IDs, positions, per-project numbers, branded strings, scene
  triples), `tables` map in schema order. Compatibility policy: accept every
  version ≤ current; missing tables restored as empty, unknown tables
  ignored, rows validated structurally; newer versions rejected with
  "update the app first". Restore replaces everything and is always
  preceded by a preview with a "Download current data first" escape hatch.
- **Task transfer** — per-project export/import, Kaneo-compatible JSON
  interchange: project metadata + tasks, HTML descriptions (Markdown↔HTML
  conversion), ISO datetimes, `userId: null`, `archivedAt` in ISO form (round
  trips preserve archive state). Append-only: re-importing duplicates.
  Per-task outcomes reported; labels reused or created by name.

Backup is for the user's own safekeeping; transfer is for interoperating
with other tools. Do not merge them.

## Consequences

- Two code paths, two docs, two test suites — accepted; the formats serve
  different masters (fidelity vs interoperability).
- Backup restore is destructive by design (wipe-and-replace); the preview +
  pre-restore download keep that safe.
- Transfer accepts full exports, `{ tasks: [...] }`, or a bare task array;
  export bytes are deterministic (code-point label order) for diffable
  output and testability.
- Encrypted export/import is specced (AES-256-GCM, passphrase at export) but
  not implemented; when it lands it will wrap the backup format, not fork it.
