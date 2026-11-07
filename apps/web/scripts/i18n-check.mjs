/**
 * Locale parity check.
 *
 * Verifies every shipped locale against the default locale (`en-US.json`):
 *   - Missing keys: present in the default locale, absent from another.
 *   - Extra keys: present in another locale, absent from the default — the
 *     resources are one shape per locale, so drift in either direction fails.
 *   - Placeholder mismatches: interpolation variables differ from the
 *     default locale's for the same key (a translator dropping {{count}} or
 *     renaming {{name}} would ship a broken string).
 *   - Empty values: a leaf that is not a non-empty string.
 * Exits non-zero on any drift. Plain Node, no dependencies.
 *
 * Adapted from the Kaneo example's `scripts/i18n/check.mjs`, deliberately
 * simplified: Kaneo also validates per-language CLDR plural categories
 * (demanding e.g. `_many` for French's million-form). Our resource design
 * keeps `_one`/`_other` families only and relies on the engine's fallback to
 * `_other` for categories we don't declare, so identical key sets — not
 * CLDR category sets — are the parity contract here. A locale that later
 * wants its own plural forms can extend this check then.
 *
 * Usage: `pnpm i18n:check` (from `apps/web`).
 * `--locales <dir>` overrides the locales directory (default: the shipped
 * one); it exists so the tool is testable against fixtures.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const args = process.argv.slice(2);
const localesDir =
  argValue("--locales") ?? path.join(appRoot, "src/lib/i18n/locales");
const REFERENCE_LOCALE = "en-US";

function argValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function flatten(node, segments = [], out = new Map()) {
  if (typeof node === "object" && node !== null && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) {
      flatten(value, [...segments, key], out);
    }
    return out;
  }
  out.set(segments.join("."), node);
  return out;
}

function placeholders(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]);
}

function loadLocale(file) {
  return flatten(JSON.parse(fs.readFileSync(file, "utf8")));
}

const referenceFile = path.join(localesDir, `${REFERENCE_LOCALE}.json`);
if (!fs.existsSync(referenceFile)) {
  console.error(`Reference locale not found: ${referenceFile}`);
  process.exit(1);
}
const reference = loadLocale(referenceFile);
const referenceKeys = new Set(reference.keys());

const localeFiles = fs
  .readdirSync(localesDir)
  .filter((name) => name.endsWith(".json"))
  .sort();

let hasIssues = false;

for (const file of localeFiles) {
  const locale = file.slice(0, -".json".length);
  if (locale === REFERENCE_LOCALE) continue;
  const data = loadLocale(path.join(localesDir, file));
  const keys = new Set(data.keys());

  const missing = [...referenceKeys].filter((key) => !keys.has(key)).sort();
  const extra = [...keys].filter((key) => !referenceKeys.has(key)).sort();
  const empty = [...data.entries()]
    .filter(([, value]) => typeof value !== "string" || value.trim() === "")
    .map(([key]) => key)
    .sort();
  const placeholderMismatches = [...reference.entries()]
    .filter(([key, refValue]) => {
      if (!data.has(key)) return false;
      const expected = placeholders(refValue).sort().join(",");
      const actual = placeholders(data.get(key)).sort().join(",");
      return expected !== actual;
    })
    .map(([key]) => key)
    .sort();

  if (
    missing.length === 0 &&
    extra.length === 0 &&
    empty.length === 0 &&
    placeholderMismatches.length === 0
  ) {
    console.log(`${locale}: OK`);
    continue;
  }

  hasIssues = true;
  console.log(`${locale}:`);
  if (missing.length > 0) {
    console.log("  Missing keys:");
    for (const key of missing) console.log(`    - ${key}`);
  }
  if (extra.length > 0) {
    console.log("  Extra keys:");
    for (const key of extra) console.log(`    - ${key}`);
  }
  if (empty.length > 0) {
    console.log("  Empty values:");
    for (const key of empty) console.log(`    - ${key}`);
  }
  if (placeholderMismatches.length > 0) {
    console.log("  Placeholder mismatches:");
    for (const key of placeholderMismatches) console.log(`    - ${key}`);
  }
}

if (!hasIssues) {
  console.log(`All locale files are in sync with ${REFERENCE_LOCALE}.`);
  process.exit(0);
}

process.exit(1);
