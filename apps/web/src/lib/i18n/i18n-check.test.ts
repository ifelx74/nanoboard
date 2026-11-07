/// <reference types="node" />
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../scripts/i18n-check.mjs",
);

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function runCheck(locales: Record<string, unknown>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-check-"));
  tmpDirs.push(root);
  for (const [name, content] of Object.entries(locales)) {
    fs.writeFileSync(path.join(root, name), JSON.stringify(content));
  }
  const result = spawnSync(process.execPath, [scriptPath, "--locales", root], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout };
}

const EN = {
  common: {
    close: "Close",
    more_one: "{{count}} more",
    more_other: "{{count}} more",
  },
  navigation: { home: "Home" },
};

describe("i18n locale parity check", () => {
  it("is clean when a locale matches the default exactly", () => {
    const { status, stdout } = runCheck({
      "en-US.json": EN,
      "fr-FR.json": {
        common: {
          close: "Fermer",
          more_one: "{{count}} autre",
          more_other: "{{count}} autres",
        },
        navigation: { home: "Accueil" },
      },
    });
    expect(status).toBe(0);
    expect(stdout).toContain("fr-FR: OK");
  });

  it("exits non-zero and lists missing and extra keys", () => {
    const { status, stdout } = runCheck({
      "en-US.json": EN,
      "fr-FR.json": {
        common: { close: "Fermer" },
        navigation: { home: "Accueil", away: "Ailleurs" },
      },
    });
    expect(status).toBe(1);
    expect(stdout).toContain("common.more_one");
    expect(stdout).toContain("navigation.away");
  });

  it("exits non-zero on placeholder mismatches and empty values", () => {
    const { status, stdout } = runCheck({
      "en-US.json": EN,
      "fr-FR.json": {
        common: {
          close: "",
          more_one: "{{total}} autre",
          more_other: "{{count}} autres",
        },
        navigation: { home: "Accueil" },
      },
    });
    expect(status).toBe(1);
    expect(stdout).toContain("common.more_one");
    expect(stdout).toContain("common.close");
  });
});
