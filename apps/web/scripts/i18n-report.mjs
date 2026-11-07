/**
 * Static translation-key usage report.
 *
 * Scans static translation-key usages in `src/` against the default-locale
 * resources (`src/lib/i18n/locales/en-US.json`) and reports:
 *   - Missing keys: used in code but absent from the resources.
 *   - Unused keys: present in the resources but never used in code.
 *   - Dynamic keys: `t()` calls whose key cannot be verified statically.
 * Exits non-zero on any of the three (drift). The typed-key surface
 * (`src/lib/i18n/types.ts`) is the primary missing-key gate at compile time;
 * this report catches what types cannot see — stale keys left behind by a
 * rename, resource keys nothing references anymore, and dynamic calls that
 * bypass the typed surface — and is the extraction gate for agents.
 *
 * Adapted from the Kaneo example's `scripts/i18n/report.mjs`: only the
 * missing/unused/dynamic report shape is ported. The Kaneo parity-check
 * (`check`) and schema-generation (`schema`) scripts are deliberately not
 * ported — parity is meaningless with a single locale, and typed keys
 * already cover missing keys at compile time. `--fix` pruning is not
 * ported either: this tool only reports.
 *
 * How usages are recognised (a heuristic, documented so its blind spots are
 * known — typed keys remain the primary gate):
 *   - Hook calls: `t("key")` / an alias destructured from
 *     `useTranslation("ns")`, e.g. `const { t: tNav } = useTranslation("navigation")`.
 *     Bare keys resolve against that namespace; a no-argument
 *     `useTranslation()` resolves against the default namespace (`common`).
 *   - Singleton calls: `i18n.t("ns:key")` — keys must be fully qualified
 *     (`ns:path`) or resolve against `common`.
 *   - `i18nKey="ns:key"` props and literals passed through the narrow
 *     `dynamicKey("ns:key")` escape hatch are counted as static usages.
 *   - Plural forms: using a base key (`overflowMore`) counts every suffixed
 *     leaf (`overflowMore_one`, `overflowMore_other`, …) as used, and a
 *     suffixed usage is represented by its family.
 *   - Anything else passed to a `t()`-shaped call (a variable, a template
 *     literal, …) is a dynamic key and fails the report: reach for
 *     `dynamicKey` with a literal, or split the key, instead.
 *   - Test files count as usage: the runtime integration probe exercises
 *     real keys through the real resources, and excluding tests would flag
 *     the not-yet-extracted plural family as unused drift today. (The
 *     hard-coded-string audit, by contrast, excludes tests — see
 *     `i18n-audit.md` alongside this script.)
 *
 * Usage: `pnpm i18n:report` (from `apps/web`). Plain Node, no dependencies.
 * `--src <dir>` / `--resources <file>` override the scanned tree and the
 * resource file; they exist so the tool is testable against fixtures.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other"];
const DEFAULT_NAMESPACE = "common";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const args = process.argv.slice(2);
const srcDir = argValue("--src") ?? path.join(appRoot, "src");
const resourcesFile =
  argValue("--resources") ??
  path.join(appRoot, "src/lib/i18n/locales/en-US.json");

function argValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function flattenResources(resources) {
  const keys = new Set();
  const walk = (node, segments) => {
    if (typeof node === "object" && node !== null && !Array.isArray(node)) {
      for (const [key, value] of Object.entries(node)) {
        walk(value, [...segments, key]);
      }
      return;
    }
    const [namespace, ...rest] = segments;
    keys.add(rest.length > 0 ? `${namespace}:${rest.join(".")}` : namespace);
  };
  for (const [namespace, value] of Object.entries(resources)) {
    walk(value, [namespace]);
  }
  return keys;
}

function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, out);
    else if (/\.(ts|tsx)$/u.test(entry.name)) out.push(full);
  }
  return out;
}

function resolveKey(rawKey, namespace) {
  return rawKey.includes(":") ? rawKey : `${namespace}:${rawKey}`;
}

function collectFileKeys(source) {
  const staticKeys = new Set();
  const dynamicCalls = [];

  // Map each t-alias in this file to its hook namespace, e.g.
  // `const { t: tNav } = useTranslation("navigation")` -> tNav -> navigation.
  const aliases = new Map();
  const hookPattern =
    /\{\s*t(?:\s*:\s*([\w$]+))?\s*\}\s*=\s*useTranslation\(\s*(?:\[\s*)?(?:['"]([\w-]+)['"])?/gu;
  for (const match of source.matchAll(hookPattern)) {
    aliases.set(match[1] ?? "t", match[2] ?? DEFAULT_NAMESPACE);
  }
  const fileNamespaces = [...new Set(aliases.values())];

  const namespaceFor = (callee) => {
    if (aliases.has(callee)) return aliases.get(callee);
    if (callee === "t" && fileNamespaces.length === 1) return fileNamespaces[0];
    return DEFAULT_NAMESPACE;
  };

  // Static calls through an alias or bare `t`: t("key"), tNav('key').
  for (const match of source.matchAll(/\b([\w$]+)\(\s*(['"])([^'"]+)\2/gu)) {
    const [, callee, , rawKey] = match;
    if (callee !== "t" && !aliases.has(callee)) continue;
    staticKeys.add(resolveKey(rawKey, namespaceFor(callee)));
  }

  // Static calls through the singleton: i18n.t("ns:key").
  for (const match of source.matchAll(/\b[\w$]+\.t\(\s*(['"])([^'"]+)\1/gu)) {
    staticKeys.add(resolveKey(match[2], DEFAULT_NAMESPACE));
  }

  // i18nKey props and literals through the dynamicKey escape hatch.
  for (const match of source.matchAll(
    /\bi18nKey\s*=\s*\{?\s*(['"])([^'"]+)\1/gu,
  )) {
    staticKeys.add(resolveKey(match[2], DEFAULT_NAMESPACE));
  }
  for (const match of source.matchAll(/\bdynamicKey\(\s*(['"])([^'"]+)\1/gu)) {
    staticKeys.add(resolveKey(match[2], DEFAULT_NAMESPACE));
  }

  // Dynamic calls: a t-shaped call whose first argument is not a string
  // literal (and not a dynamicKey(...) literal, counted above).
  const dynamicPattern = /\b([\w$]+)(?:\.t)?\(\s*([^'"\s)])([^,\n)]*)/gu;
  for (const match of source.matchAll(dynamicPattern)) {
    const [, callee, firstArg] = match;
    const isTCall =
      callee === "t" ||
      aliases.has(callee) ||
      source.slice(match.index, match.index + match[0].length).includes(".t(");
    if (!isTCall) continue;
    if (firstArg.startsWith("dynamicKey")) continue;
    dynamicCalls.push(match[0].trim());
  }

  return { staticKeys, dynamicCalls };
}

function main() {
  const resources = JSON.parse(fs.readFileSync(resourcesFile, "utf8"));
  const localeKeys = flattenResources(resources);

  const staticKeys = new Set();
  const dynamicCalls = [];
  for (const file of collectSourceFiles(srcDir)) {
    const { staticKeys: fileKeys, dynamicCalls: fileDynamic } = collectFileKeys(
      fs.readFileSync(file, "utf8"),
    );
    for (const key of fileKeys) staticKeys.add(key);
    for (const call of fileDynamic) {
      dynamicCalls.push(`${path.relative(appRoot, file)}: ${call}`);
    }
  }

  const isRepresented = (key) =>
    localeKeys.has(key) ||
    PLURAL_SUFFIXES.some((suffix) => localeKeys.has(`${key}${suffix}`));
  const isUsed = (leaf) => {
    if (staticKeys.has(leaf)) return true;
    const base = leaf.replace(/_(zero|one|two|few|many|other)$/u, "");
    return base !== leaf && staticKeys.has(base);
  };

  const missing = [...staticKeys].filter((key) => !isRepresented(key)).sort();
  const unused = [...localeKeys].filter((key) => !isUsed(key)).sort();
  dynamicCalls.sort();

  if (
    missing.length === 0 &&
    unused.length === 0 &&
    dynamicCalls.length === 0
  ) {
    console.log("i18n report is clean.");
    process.exit(0);
  }

  if (missing.length > 0) {
    console.log("Missing keys:");
    for (const key of missing) console.log(`  - ${key}`);
  }
  if (unused.length > 0) {
    console.log("Unused keys:");
    for (const key of unused) console.log(`  - ${key}`);
  }
  if (dynamicCalls.length > 0) {
    console.log("Dynamic keys:");
    for (const call of dynamicCalls) console.log(`  - ${call}`);
  }
  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`i18n report failed: ${error.message}`);
  process.exit(1);
}
