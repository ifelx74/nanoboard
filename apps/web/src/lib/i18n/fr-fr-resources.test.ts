import { describe, expect, it } from "vitest";
import enUS from "./locales/en-US.json";
import frFR from "./locales/fr-FR.json";

function flatten(
  node: unknown,
  segments: string[] = [],
  out = new Map<string, string>(),
): Map<string, string> {
  if (typeof node === "object" && node !== null && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) {
      flatten(value, [...segments, key], out);
    }
    return out;
  }
  out.set(segments.join("."), node as string);
  return out;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
}

describe("fr-FR resources", () => {
  it("ships exactly the default locale's keys with matching placeholders", () => {
    const en = flatten(enUS);
    const fr = flatten(frFR);
    expect([...fr.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [key, enValue] of en) {
      expect(placeholders(fr.get(key) ?? ""), key).toEqual(
        placeholders(enValue),
      );
      expect((fr.get(key) ?? "").trim().length, key).toBeGreaterThan(0);
    }
  });

  it("carries real French translations, not copies of the default", () => {
    const fr = flatten(frFR);
    expect(fr.get("navigation.home")).toBe("Accueil");
    expect(fr.get("common.close")).toBe("Fermer");
    expect(fr.get("settings.language.system")).toBe("Système");
    expect(fr.get("home.tasks_other")).toBe("{{count}} tâches");
  });
});
