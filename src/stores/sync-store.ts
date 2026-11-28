import { create } from "zustand";

/**
 * off: sync isn't set up, or the demo profile is open.
 * signed-out / checking / choose (first sign-in, both have data) / syncing / synced /
 * offline (changes wait on this device) / error.
 */
export type SyncStatus =
  "off" | "signed-out" | "checking" | "choose" | "syncing" | "synced" | "offline" | "error";

interface SyncState {
  status: SyncStatus;
  email: string | null;
  /** When the last sync finished (ISO). */
  lastSyncedAt: string | null;
  error: string | null;
  /** Records that couldn't be read at the last sync. */
  skipped: number;
  set: (patch: Partial<Omit<SyncState, "set">>) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  status: "off",
  email: null,
  lastSyncedAt: null,
  error: null,
  skipped: 0,
  set: (patch) => set(patch),
}));
