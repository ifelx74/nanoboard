import { defineConfig } from "vitest/config";
import pkg from "./package.json";

// Tests run in plain Node — the only code under test so far is the data
// layer, whose browser dependency (IndexedDB) is replaced in-memory by
// fake-indexeddb (installed globally by the test helper in
// src/lib/db/test-db.ts). No DOM environment, no react plugins: this config
// deliberately stands apart from vite.config.ts so the app build chain never
// loads for tests.
//
// The one define shared with vite.config.ts is __APP_VERSION__: the backup
// module is a data-layer unit tests exercise, and its envelope header embeds
// that constant.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
