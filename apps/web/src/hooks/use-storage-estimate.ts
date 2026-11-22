import { useEffect, useState } from "react";
import {
  extractStorageUsage,
  type StorageUsageSnapshot,
} from "@/lib/backup/storage-status";

const REFRESH_INTERVAL_MS = 60_000;

const EMPTY_SNAPSHOT: StorageUsageSnapshot = {
  bytes: null,
  quota: null,
  isApproximate: true,
};

/**
 * Periodically polls `navigator.storage.estimate()` (plus on window focus /
 * tab visibility) so the sidebar can display how much local storage the app
 * currently occupies without scanning IndexedDB tables.
 */
export function useStorageEstimate(): StorageUsageSnapshot {
  const [snapshot, setSnapshot] =
    useState<StorageUsageSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    const estimator = globalThis.navigator?.storage?.estimate;
    if (typeof estimator !== "function") {
      return undefined;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const estimate = await globalThis.navigator.storage.estimate();
        if (!cancelled) {
          setSnapshot(extractStorageUsage(estimate));
        }
      } catch {
        // Keep the last known snapshot when the browser rejects estimate().
      }
    };

    void refresh();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    const handleFocus = () => {
      void refresh();
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, REFRESH_INTERVAL_MS);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return snapshot;
}
