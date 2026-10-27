import { defineConfig } from "vitest/config";

// Tests run in plain Node — the only code under test so far is the data
// layer, whose browser dependency (IndexedDB) is replaced in-memory by
// fake-indexeddb (installed globally by the test helper in
// src/lib/db/test-db.ts). No DOM environment, no react plugins: this config
// deliberately stands apart from vite.config.ts so the app build chain never
// loads for tests.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
