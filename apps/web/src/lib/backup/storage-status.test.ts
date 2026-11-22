import { describe, expect, it } from "vitest";
import {
  BACKUP_STALE_MS,
  NEVER_BACKED_UP_WARNING_BYTES,
  extractStorageUsage,
  formatBackupAge,
  formatBytes,
  getStorageAlertLevel,
  parseLastBackupAt,
} from "./storage-status";

describe("parseLastBackupAt", () => {
  it("accepts positive finite timestamps and rejects invalid values", () => {
    expect(parseLastBackupAt(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(parseLastBackupAt(0)).toBeNull();
    expect(parseLastBackupAt(-100)).toBeNull();
    expect(parseLastBackupAt(Number.NaN)).toBeNull();
    expect(parseLastBackupAt(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseLastBackupAt("1700000000000")).toBeNull();
    expect(parseLastBackupAt(null)).toBeNull();
    expect(parseLastBackupAt(undefined)).toBeNull();
  });
});

describe("extractStorageUsage", () => {
  it("prefers Chromium usageDetails.indexedDB when available", () => {
    const estimate = {
      usage: 50_000_000,
      quota: 500_000_000,
      usageDetails: { indexedDB: 2_500_000 },
    } as StorageEstimate;

    expect(extractStorageUsage(estimate)).toEqual({
      bytes: 2_500_000,
      quota: 500_000_000,
      isApproximate: false,
    });
  });

  it("falls back to total usage when usageDetails is absent", () => {
    expect(
      extractStorageUsage({ usage: 4_000_000, quota: 100_000_000 }),
    ).toEqual({
      bytes: 4_000_000,
      quota: 100_000_000,
      isApproximate: true,
    });
  });

  it("handles missing or empty estimates", () => {
    expect(extractStorageUsage(null)).toEqual({
      bytes: null,
      quota: null,
      isApproximate: true,
    });
    expect(extractStorageUsage({})).toEqual({
      bytes: null,
      quota: null,
      isApproximate: true,
    });
  });
});

describe("formatBytes", () => {
  it("formats bytes, KB, MB, and GB cleanly", () => {
    expect(formatBytes(0, "en-US")).toBe("0 B");
    expect(formatBytes(-50, "en-US")).toBe("0 B");
    expect(formatBytes(512, "en-US")).toBe("512 B");
    expect(formatBytes(2048, "en-US")).toBe("2 KB");
    expect(formatBytes(1.5 * 1024 * 1024, "en-US")).toBe("1.5 MB");
    expect(formatBytes(150 * 1024 * 1024, "en-US")).toBe("150 MB");
    expect(formatBytes(2.25 * 1024 * 1024 * 1024, "en-US")).toBe("2.3 GB");
  });
});

describe("formatBackupAge", () => {
  const NOW = 1_800_000_000_000;

  it("returns justNow for ages under one minute", () => {
    expect(formatBackupAge(NOW - 30_000, NOW, "en-US")).toEqual({
      kind: "justNow",
    });
    expect(formatBackupAge(NOW + 5_000, NOW, "en-US")).toEqual({
      kind: "justNow",
    });
  });

  it("formats minutes, hours, days, and months", () => {
    expect(formatBackupAge(NOW - 5 * 60_000, NOW, "en-US")).toEqual({
      kind: "relative",
      text: "5 minutes ago",
    });
    expect(formatBackupAge(NOW - 3 * 3_600_000, NOW, "en-US")).toEqual({
      kind: "relative",
      text: "3 hours ago",
    });
    expect(formatBackupAge(NOW - 24 * 3_600_000, NOW, "en-US")).toEqual({
      kind: "relative",
      text: "yesterday",
    });
    expect(formatBackupAge(NOW - 5 * 24 * 3_600_000, NOW, "en-US")).toEqual({
      kind: "relative",
      text: "5 days ago",
    });
    expect(formatBackupAge(NOW - 45 * 24 * 3_600_000, NOW, "en-US")).toEqual({
      kind: "relative",
      text: "last month",
    });
  });
});

describe("getStorageAlertLevel", () => {
  const NOW = 1_800_000_000_000;

  it("stays normal for small unbacked-up databases", () => {
    expect(
      getStorageAlertLevel({
        bytes: 200 * 1024,
        quota: 100 * 1024 * 1024,
        lastBackupAt: null,
        now: NOW,
      }),
    ).toBe("normal");
  });

  it("warns when never backed up and storage reaches the threshold", () => {
    expect(
      getStorageAlertLevel({
        bytes: NEVER_BACKED_UP_WARNING_BYTES,
        quota: 100 * 1024 * 1024,
        lastBackupAt: null,
        now: NOW,
      }),
    ).toBe("warning");
  });

  it("stays normal after a recent backup and warns once stale", () => {
    expect(
      getStorageAlertLevel({
        bytes: 10 * 1024 * 1024,
        quota: 100 * 1024 * 1024,
        lastBackupAt: NOW - 3 * 24 * 3_600_000,
        now: NOW,
      }),
    ).toBe("normal");

    expect(
      getStorageAlertLevel({
        bytes: 10 * 1024 * 1024,
        quota: 100 * 1024 * 1024,
        lastBackupAt: NOW - BACKUP_STALE_MS,
        now: NOW,
      }),
    ).toBe("warning");
  });

  it("warns under quota pressure even with a recent backup", () => {
    expect(
      getStorageAlertLevel({
        bytes: 80 * 1024 * 1024,
        quota: 100 * 1024 * 1024,
        lastBackupAt: NOW - 60_000,
        now: NOW,
      }),
    ).toBe("warning");
  });
});
