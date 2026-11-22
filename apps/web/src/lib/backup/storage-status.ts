/**
 * Pure local-storage and backup-recency helpers, kept DOM-free so the plain
 * Node Vitest suite covers them directly.
 */

import { formatRelativeTime, getActiveLocale } from "@/lib/format";

/** localStorage key for the persisted backup-status store envelope. */
export const BACKUP_STATUS_STORAGE_KEY = "nanoboard-backup-status";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/** Warn once the last whole-workspace backup is at least 14 days old. */
export const BACKUP_STALE_DAYS = 14;
export const BACKUP_STALE_MS = BACKUP_STALE_DAYS * DAY_MS;

/**
 * Warn when no whole-workspace backup has been downloaded and local storage
 * has grown past 1 MB (keeps fresh / demo databases calm).
 */
export const NEVER_BACKED_UP_WARNING_BYTES = 1 * 1024 * 1024;

/** Warn when origin storage reaches 75% of the browser's reported quota. */
export const STORAGE_QUOTA_WARNING_RATIO = 0.75;

export type StorageAlertLevel = "normal" | "warning";

export interface StorageUsageSnapshot {
  bytes: number | null;
  quota: number | null;
  /**
   * True when `bytes` comes from total origin `usage` (which may include PWA
   * caches) rather than Chromium's `usageDetails.indexedDB`.
   */
  isApproximate: boolean;
}

export type BackupAge =
  { kind: "justNow" } | { kind: "relative"; text: string };

interface StorageEstimateWithDetails extends StorageEstimate {
  usageDetails?: {
    indexedDB?: number;
  };
}

const RELATIVE_AGE_UNITS: ReadonlyArray<{
  maxMs: number;
  unitMs: number;
  unit: Intl.RelativeTimeFormatUnit;
}> = [
  { maxMs: HOUR_MS, unitMs: MINUTE_MS, unit: "minute" },
  { maxMs: DAY_MS, unitMs: HOUR_MS, unit: "hour" },
  { maxMs: MONTH_MS, unitMs: DAY_MS, unit: "day" },
  { maxMs: YEAR_MS, unitMs: MONTH_MS, unit: "month" },
  { maxMs: Number.POSITIVE_INFINITY, unitMs: YEAR_MS, unit: "year" },
];

/** Defensive parse for a persisted epoch-ms timestamp. */
export function parseLastBackupAt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

/**
 * Extract storage usage from `navigator.storage.estimate()`. Prefers
 * Chromium's `usageDetails.indexedDB` when present so PWA static caches don't
 * inflate the number; falls back to total origin `usage` on other browsers.
 */
export function extractStorageUsage(
  estimate: StorageEstimate | null | undefined,
): StorageUsageSnapshot {
  if (!estimate) {
    return { bytes: null, quota: null, isApproximate: true };
  }

  const quota =
    typeof estimate.quota === "number" &&
    Number.isFinite(estimate.quota) &&
    estimate.quota > 0
      ? estimate.quota
      : null;

  const indexedDb = (estimate as StorageEstimateWithDetails).usageDetails
    ?.indexedDB;
  if (
    typeof indexedDb === "number" &&
    Number.isFinite(indexedDb) &&
    indexedDb >= 0
  ) {
    return { bytes: indexedDb, quota, isApproximate: false };
  }

  if (
    typeof estimate.usage === "number" &&
    Number.isFinite(estimate.usage) &&
    estimate.usage >= 0
  ) {
    return { bytes: estimate.usage, quota, isApproximate: true };
  }

  return { bytes: null, quota, isApproximate: true };
}

/** Format a byte count into a compact, locale-aware string (e.g. `12.4 MB`). */
export function formatBytes(bytes: number, locale?: string): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const activeLocale = locale ?? getActiveLocale();

  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (safe < KB) {
    return `${Math.round(safe)} B`;
  }
  if (safe < MB) {
    const formatted = new Intl.NumberFormat(activeLocale, {
      maximumFractionDigits: 0,
    }).format(safe / KB);
    return `${formatted} KB`;
  }
  if (safe < GB) {
    const value = safe / MB;
    const formatted = new Intl.NumberFormat(activeLocale, {
      maximumFractionDigits: value < 100 ? 1 : 0,
    }).format(value);
    return `${formatted} MB`;
  }

  const value = safe / GB;
  const formatted = new Intl.NumberFormat(activeLocale, {
    maximumFractionDigits: 1,
  }).format(value);
  return `${formatted} GB`;
}

/**
 * Format how long ago `lastBackupAt` occurred using `Intl.RelativeTimeFormat`.
 * Sub-minute ages return `{ kind: "justNow" }` so callers can render localized
 * copy without saying "0 minutes ago".
 */
export function formatBackupAge(
  lastBackupAt: number,
  now: number = Date.now(),
  locale?: string,
): BackupAge {
  const diffMs = Math.max(0, now - lastBackupAt);
  if (diffMs < MINUTE_MS) {
    return { kind: "justNow" };
  }

  const entry =
    RELATIVE_AGE_UNITS.find((candidate) => diffMs < candidate.maxMs) ??
    RELATIVE_AGE_UNITS[RELATIVE_AGE_UNITS.length - 1]!;

  return {
    kind: "relative",
    text: formatRelativeTime(
      -Math.floor(diffMs / entry.unitMs),
      entry.unit,
      locale,
      "auto",
    ),
  };
}

/**
 * Escalate the sidebar storage card to a warning state when data is at
 * meaningful risk: quota pressure, stale backup (≥ 14d), or ≥ 1 MB stored with
 * no whole-workspace backup ever downloaded.
 */
export function getStorageAlertLevel({
  bytes,
  quota,
  lastBackupAt,
  now = Date.now(),
}: {
  bytes: number | null;
  quota: number | null;
  lastBackupAt: number | null;
  now?: number;
}): StorageAlertLevel {
  if (
    quota !== null &&
    quota > 0 &&
    bytes !== null &&
    bytes / quota >= STORAGE_QUOTA_WARNING_RATIO
  ) {
    return "warning";
  }

  if (lastBackupAt === null) {
    return bytes !== null && bytes >= NEVER_BACKED_UP_WARNING_BYTES
      ? "warning"
      : "normal";
  }

  if (now - lastBackupAt >= BACKUP_STALE_MS) {
    return "warning";
  }

  return "normal";
}
