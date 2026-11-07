/// <reference types="node" />
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../scripts/i18n-report.mjs",
);

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function runReport(sourceFiles: Record<string, string>, resources: unknown) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-report-"));
  tmpDirs.push(root);
  const srcDir = path.join(root, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  for (const [name, content] of Object.entries(sourceFiles)) {
    const file = path.join(srcDir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content.replaceAll("__T__", "t"));
  }
  const resourcesFile = path.join(root, "en-US.json");
  fs.writeFileSync(resourcesFile, JSON.stringify(resources));

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--src", srcDir, "--resources", resourcesFile],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

const NAV_SOURCE = `
import { useTranslation } from "react-i18next";
export function Nav() {
  const { t } = useTranslation("navigation");
  return __T__("home");
}
`;

describe("i18n static usage report", () => {
  it("is clean when every static usage resolves and every key is used", () => {
    const { status, stdout } = runReport(
      { "nav.tsx": NAV_SOURCE },
      { navigation: { home: "Home" }, common: {} },
    );
    expect(status).toBe(0);
    expect(stdout).toContain("clean");
  });

  it("resolves fully-qualified singleton calls and plural base usage", () => {
    const { status, stdout } = runReport(
      {
        "a.tsx": `
          import { i18n } from "@/lib/i18n";
          export const label = i18n.__T__("common:hello");
          export const more = i18n.__T__("calendar:overflowMore", { count: 2 });
        `,
      },
      {
        common: { hello: "Hello" },
        calendar: {
          overflowMore_one: "+{{count}} more",
          overflowMore_other: "+{{count}} more",
        },
      },
    );
    expect(status).toBe(0);
    expect(stdout).toContain("clean");
  });

  it("exits non-zero and lists keys used in code but missing from resources", () => {
    const { status, stdout } = runReport(
      { "nav.tsx": NAV_SOURCE.replace('__T__("home")', '__T__("away")') },
      { navigation: { home: "Home" }, common: {} },
    );
    expect(status).toBe(1);
    expect(stdout).toContain("navigation:away");
  });

  it("exits non-zero and lists resource keys never used", () => {
    const { status, stdout } = runReport(
      { "nav.tsx": NAV_SOURCE },
      {
        navigation: { home: "Home", away: "Away" },
        common: {},
      },
    );
    expect(status).toBe(1);
    expect(stdout).toContain("navigation:away");
  });

  it("exits non-zero on dynamic key expressions it cannot verify", () => {
    const { status, stdout } = runReport(
      {
        "nav.tsx": `
          import { useTranslation } from "react-i18next";
          export function Nav({ key: k }: { key: string }) {
            const { t } = useTranslation("navigation");
            return __T__(k);
          }
        `,
      },
      { navigation: { home: "Home" }, common: {} },
    );
    expect(status).toBe(1);
    expect(stdout).toContain("Dynamic keys:");
  });
});
