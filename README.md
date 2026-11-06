<p align="center">
  <img src="apps/web/public/pwa-192x192.png" alt="Nanoboard" width="52">
</p>

<h4 align="center">
  <a href="https://nanoboard.pages.dev">Open the app</a> |
  <a href="#features">Features</a> |
  <a href="#project-structure">Project structure</a> |
  <a href="#built-with">Built with</a> |
  <a href="./CONTRIBUTING.md">Contributing</a>
</h4>

<div align="center">
  <h2>
    A minimalist, local-first space for your tasks. </br>
    Kanban board, whiteboard, calendar, and sticky notes — fast, private, and 100% stored in your browser. </br>
  <br />
  </h2>
</div>

<br />
<p align="center">
  <a href="LICENSE">
    <img alt="nanoboard is released under the MIT license." src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat" /></a>
  <a href="https://github.com/ifelx74/nanoboard/actions/workflows/deploy.yml">
    <img alt="Deploy status" src="https://github.com/ifelx74/nanoboard/actions/workflows/deploy.yml/badge.svg" /></a>
  <a href="#contributing">
    <img alt="PRs welcome!" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" /></a>
  <a href="#features">
    <img alt="Works offline" src="https://img.shields.io/badge/PWA-offline--ready-blue.svg?style=flat" /></a>
  <a href="#features">
    <img alt="Local-first" src="https://img.shields.io/badge/storage-100%25%20local-orange.svg?style=flat" /></a>
  <img alt="Made with TypeScript" src="https://img.shields.io/badge/100%25-TypeScript-3178c6.svg?style=flat&logo=typescript&logoColor=white" />
</p>

<div align="center">
  <figure>
    <a href="https://nanoboard.pages.dev" target="_blank" rel="noopener">
      <img alt="nanoboard" src="apps/web/public/og-image.png" width="100%" />
    </a>
    <figcaption>
      <p align="center">
        Plan tasks, sketch ideas, and keep everything private on your device.
      </p>
    </figcaption>
  </figure>
</div>

## Features

nanoboard supports:

- 🗂️&nbsp;Projects to organize your tasks.
- 📋&nbsp;Kanban board with drag-and-drop task management.
- 📝&nbsp;List view for a linear overview of tasks.
- 🖌️&nbsp;Infinite-canvas whiteboard powered by Excalidraw.
- 📅&nbsp;Calendar view to plan tasks by date.
- 🗒️&nbsp;Sticky notes for quick thoughts.
- ✍️&nbsp;Rich-text tasks with links, images, and checklists.
- 🔒&nbsp;Private by design — no account, no server; your data lives in your browser (IndexedDB).
- 📡&nbsp;PWA support — installable and works offline.
- 🌓&nbsp;Dark mode.
- 🪶&nbsp;Minimalist and fast.

## Project structure

nanoboard is a pnpm + Turborepo monorepo:

- `apps/web/` — the only app: React 19, Vite, TanStack Router, Tailwind CSS 4, PWA.
  - `src/routes/` — TanStack Router file-based routes.
  - `src/components/` — feature components (`kanban-board/`, `whiteboard/`, `stickies/`, …) and shadcn/ui primitives.
  - `src/lib/db/` — the Dexie data layer: every read and write goes through here; data lives in the browser's IndexedDB.
  - `src/lib/editor/`, `src/lib/backup/` — TipTap rich text and export/import.
- `packages/` — shared ESLint and TypeScript config.

## Built with

- [React](https://react.dev) 19 and [Vite](https://vite.dev)
- [TanStack Router](https://tanstack.com/router) for routing
- [Tailwind CSS](https://tailwindcss.com) for styling
- [shadcn/ui](https://ui.shadcn.com) for the component system
- [Excalidraw](https://github.com/excalidraw/excalidraw) for the whiteboard
- [TipTap](https://tiptap.dev) for rich-text editing
- [Dexie](https://dexie.org) for local-first storage in IndexedDB
- [Zustand](https://github.com/pmndrs/zustand) for state management
- [dnd-kit](https://dndkit.com) for drag and drop
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) for PWA/offline support


## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, development commands, project guidelines, and how to submit a pull request. For bugs and feature requests, [open an issue](https://github.com/ifelx74/nanoboard/issues).

## License

nanoboard is released under the [MIT license](LICENSE).
