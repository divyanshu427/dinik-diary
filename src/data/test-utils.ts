import { createLocalDataStore, type LocalStoreOptions } from "./local/local-store";

let dbCounter = 0;

/** A fresh, isolated store with a fake clock and predictable ids. */
export function makeTestStore(options: Partial<LocalStoreOptions> = {}) {
  let tick = 0;
  let idN = 0;
  const dbName = `test-db-${++dbCounter}-${Math.random().toString(36).slice(2)}`;
  const store = createLocalDataStore({
    dbName,
    now: () => new Date(Date.UTC(2026, 10, 20, 8, 0, tick++)).toISOString(),
    newId: () => `id-${++idN}`,
    ...options,
  });
  return { store, dbName };
}
