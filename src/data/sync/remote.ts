/*
 * The cloud side of sync, as the engine sees it. The real one is Supabase
 * (supabase-remote.ts); tests use an in-memory copy with the same rules (memory-remote.ts).
 */

/** A record as stored in the cloud `records` table. */
export interface RemoteRecord {
  tbl: string;
  id: string;
  data: Record<string, unknown>;
  /** When it was last changed (the newer one wins). */
  updated_at: string;
  deleted: boolean;
  /** When the server stored it: what "changes since" is measured by. */
  synced_at: string;
}

export type PushRecord = Omit<RemoteRecord, "synced_at">;

export interface SyncRemote {
  /** Records stored at or after `since` (everything when null), oldest first. */
  pull(since: string | null, limit: number): Promise<RemoteRecord[]>;
  /**
   * Saves records and returns them as stored. A record that's older than the cloud's copy
   * is not saved: the cloud's copy comes back instead.
   */
  push(records: PushRecord[]): Promise<RemoteRecord[]>;
  /** How many records (not deleted) the account has. */
  countLive(): Promise<number>;
  /** File storage for report photos and PDFs, by report-file id. Data URLs in and out. */
  putFile(id: string, dataUrl: string, mime: string): Promise<void>;
  getFile(id: string): Promise<string>;
  removeFile(id: string): Promise<void>;
}
