/**
 * Initial-load bundle size check.
 *
 * Parses dist/index.html and sums the gzip size of every asset the document
 * pulls before the app can boot: the entry <script>, the modulepreloaded
 * chunks, and the render-blocking stylesheet. Fails (exit 1) when the totals
 * exceed the budgets below — the budgets, not a snapshot, are the guard:
 * bump them only in a PR that shows the trade-off is deliberate.
 *
 * Lazy chunks (whiteboard, locale JSONs, route code) are deliberately NOT
 * counted: they load after first paint on demand and are governed by the
 * PWA precache policy in vite.config.ts.
 *
 * Usage: `pnpm build && pnpm check:bundle` (from `apps/web`).
 * Plain Node, no dependencies.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distDir = path.join(appRoot, "dist");
const indexPath = path.join(distDir, "index.html");

// Budgets in KiB (gzip). Baseline at introduction: see PERF.md.
const LIMITS = {
  js: 240 * 1024,
  css: 30 * 1024,
};

if (!fs.existsSync(indexPath)) {
  console.error("dist/index.html not found — run `pnpm build` first.");
  process.exit(1);
}
const html = fs.readFileSync(indexPath, "utf8");

const assets = new Set();
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
  assets.add(match[1]);
}

let js = 0;
let css = 0;
const rows = [];
for (const asset of [...assets].sort()) {
  const filePath = path.join(distDir, asset);
  if (!fs.existsSync(filePath)) {
    console.error(`referenced asset missing: ${asset}`);
    process.exit(1);
  }
  const gzip = zlib.gzipSync(fs.readFileSync(filePath)).length;
  if (asset.endsWith(".js")) js += gzip;
  else if (asset.endsWith(".css")) css += gzip;
  rows.push([asset, gzip]);
}

rows.sort((a, b) => b[1] - a[1]);
for (const [asset, gzip] of rows) {
  console.log(`  ${(gzip / 1024).toFixed(1).padStart(7)} kB  ${asset}`);
}
console.log(
  `\ninitial JS:  ${(js / 1024).toFixed(1)} kB gzip (budget ${LIMITS.js / 1024} kB)`,
);
console.log(
  `initial CSS: ${(css / 1024).toFixed(1)} kB gzip (budget ${LIMITS.css / 1024} kB)`,
);

let failed = false;
if (js > LIMITS.js) {
  console.error(
    `FAIL: initial JS exceeds budget by ${((js - LIMITS.js) / 1024).toFixed(1)} kB`,
  );
  failed = true;
}
if (css > LIMITS.css) {
  console.error(
    `FAIL: initial CSS exceeds budget by ${((css - LIMITS.css) / 1024).toFixed(1)} kB`,
  );
  failed = true;
}
process.exit(failed ? 1 : 0);
