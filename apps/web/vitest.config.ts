import { defineConfig } from "vitest/config";
import path from "node:path";
import pkg from "./package.json";

// Tests run in plain Node — the only code under test so far is the data
// layer, whose browser dependency (IndexedDB) is replaced in-memory by
// fake-indexeddb (installed globally by the test helper in
// src/lib/db/test-db.ts). No DOM environment, no react plugins: this config
// deliberately stands apart from vite.config.ts so the app build chain never
// loads for tests.
//
// Shared with vite.config.ts: the __APP_VERSION__ define (the backup
// module's envelope header embeds that constant) and the `@` resolve alias,
// which data-layer modules use for runtime imports too.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
