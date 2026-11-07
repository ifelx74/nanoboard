import { describe, expect, it } from "vitest";
import enUS from "./locales/en-US.json";
import { NAMESPACES } from "./locales";

const EXPECTED_NAMESPACES = [
  "activity",
  "board",
  "calendar",
  "common",
  "home",
  "list",
  "navigation",
  "project",
  "settings",
  "stickies",
  "task",
  "whiteboard",
];

const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other"];

function leaves(
  node: unknown,
  path: string,
  out: { path: string; value: unknown }[],
): void {
  if (typeof node === "object" && node !== null) {
    const record = node as Record<string, unknown>;
    if (Object.keys(record).length === 0) return;
    for (const [key, value] of Object.entries(record)) {
      leaves(value, path ? `${path}.${key}` : key, out);
    }
    return;
  }
  out.push({ path, value: node });
}

function collect(tree: unknown): { path: string; value: unknown }[] {
  const out: { path: string; value: unknown }[] = [];
  leaves(tree, "", out);
  return out;
}

describe("en-US resources", () => {
  it("declares exactly the app's domain namespaces at the top level", () => {
    expect(Object.keys(enUS).sort()).toEqual(EXPECTED_NAMESPACES);
    expect([...NAMESPACES].sort()).toEqual(EXPECTED_NAMESPACES);
    for (const namespace of EXPECTED_NAMESPACES) {
      expect(typeof (enUS as Record<string, unknown>)[namespace]).toBe(
        "object",
      );
    }
  });

  it("has only non-empty string leaves", () => {
    const all = collect(enUS);
    expect(all.length).toBeGreaterThan(0);
    for (const { path, value } of all) {
      expect(
        typeof value === "string" && (value as string).trim() !== "",
        `${path} must be a non-empty string, got ${JSON.stringify(value)}`,
      ).toBe(true);
    }
  });

  it("has complete plural families with count placeholders", () => {
    const nonEmpty = collect(enUS).filter(
      (leaf): leaf is { path: string; value: string } =>
        typeof leaf.value === "string" && leaf.value.trim() !== "",
    );
    const paths = new Set(nonEmpty.map((leaf) => leaf.path));
    let pluralFamilies = 0;
    for (const { path, value } of nonEmpty) {
      const suffix = PLURAL_SUFFIXES.find((s) => path.endsWith(s));
      if (!suffix) continue;
      pluralFamilies += 1;
      const base = path.slice(0, -suffix.length);
      expect(
        paths.has(base),
        `${path}: plural forms should be grouped, not a bare ${suffix} key`,
      ).toBe(false);
      for (const other of PLURAL_SUFFIXES) {
        if (other === suffix) continue;
        const sibling = base + other;
        if (paths.has(sibling)) {
          expect(
            value.includes("{{count}}"),
            `${path} must contain {{count}}`,
          ).toBe(true);
        }
      }
    }
    expect(pluralFamilies).toBeGreaterThan(0);
  });
});
