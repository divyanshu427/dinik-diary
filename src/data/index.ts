import { parsePreference, THEME_STORAGE_KEY } from "@/theme/preference";
import { createLocalDataStore } from "./local/local-store";
import { dbNameFor, readProfile } from "./profile";
import type { DataStore } from "./repositories";

/*
 * The one place that decides which storage the app uses.
 * Stage 1: the browser database. Stage 2 swaps this for a Supabase store.
 */

let store: DataStore | null = null;

export function getDataStore(): DataStore {
  if (typeof window === "undefined") {
    throw new Error("The local data store only runs in the browser.");
  }
  store ??= createLocalDataStore({
    // Your own data, or the demo profile's separate database.
    dbName: dbNameFor(readProfile()),
    getTheme: () => {
      try {
        const pref = parsePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
        return { preset: pref.preset, mode: pref.mode };
      } catch {
        return undefined;
      }
    },
  });
  return store;
}

/** For tests only: use a different store. */
export function setDataStoreForTests(next: DataStore | null) {
  store = next;
}

export type { DataStore } from "./repositories";
