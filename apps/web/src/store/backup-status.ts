import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import {
  BACKUP_STATUS_STORAGE_KEY,
  parseLastBackupAt,
} from "@/lib/backup/storage-status";

interface BackupStatusStore {
  /** Epoch-ms timestamp of the most recent whole-workspace backup or restore. */
  lastBackupAt: number | null;
  recordBackup: (at?: number) => void;
}

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      // Ignore quota / private-mode storage errors; in-memory state still updates.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // Ignore storage errors.
    }
  },
};

export const useBackupStatusStore = create<BackupStatusStore>()(
  persist(
    (set) => ({
      lastBackupAt: null,
      recordBackup: (at = Date.now()) => {
        const parsed = parseLastBackupAt(at);
        if (parsed !== null) {
          set({ lastBackupAt: parsed });
        }
      },
    }),
    {
      name: BACKUP_STATUS_STORAGE_KEY,
      storage: createJSONStorage(() => safeLocalStorage),
      merge: (persisted, current) => {
        const record =
          typeof persisted === "object" && persisted !== null
            ? (persisted as { lastBackupAt?: unknown })
            : null;
        return {
          ...current,
          lastBackupAt: parseLastBackupAt(record?.lastBackupAt),
        };
      },
    },
  ),
);
