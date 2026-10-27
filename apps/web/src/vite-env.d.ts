/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Injected at build time by the `define` in vite.config.ts (and mirrored in
// vitest.config.ts) from the app's package.json version.
declare const __APP_VERSION__: string;
