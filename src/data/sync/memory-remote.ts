import type { PushRecord, RemoteRecord, SyncRemote } from "./remote";

/**
 * An in-memory cloud with the same rules as supabase/schema.sql: an older edit never
 * replaces a newer one, and every stored record gets a later `synced_at`. For tests; one
 * instance can be shared by several "devices".
 */
export class MemoryRemote implements SyncRemote {
  records = new Map<string, RemoteRecord>();
  files = new Map<string, string>();
  /** Set to make the next calls fail, as when offline. */
  offline = false;
  private clock = Date.parse("2030-01-01T00:00:00.000Z");

  private check() {
    if (this.offline) throw new Error("Failed to fetch");
  }

  private tick() {
    this.clock += 1;
    return new Date(this.clock).toISOString();
  }

  async pull(since: string | null, limit: number) {
    this.check();
    const from = since ? Date.parse(since) : -Infinity;
    return [...this.records.values()]
      .filter((r) => Date.parse(r.synced_at) >= from)
      .sort((a, b) => Date.parse(a.synced_at) - Date.parse(b.synced_at))
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }

  async push(records: PushRecord[]) {
    this.check();
    return records.map((r) => {
      const key = `${r.tbl}/${r.id}`;
      const old = this.records.get(key);
      if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) {
        return structuredClone(old);
      }
      const stored: RemoteRecord = { ...structuredClone(r), synced_at: this.tick() };
      this.records.set(key, stored);
      return structuredClone(stored);
    });
  }

  async countLive() {
    this.check();
    return [...this.records.values()].filter((r) => !r.deleted).length;
  }

  async putFile(id: string, dataUrl: string) {
    this.check();
    this.files.set(id, dataUrl);
  }

  async getFile(id: string) {
    this.check();
    const file = this.files.get(id);
    if (!file) throw new Error(`No file ${id}`);
    return file;
  }

  async removeFile(id: string) {
    this.check();
    this.files.delete(id);
  }

  /** Live records of one table, for test assertions. */
  live(tbl: string) {
    return [...this.records.values()].filter((r) => r.tbl === tbl && !r.deleted);
  }
}
