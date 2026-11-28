import { SETTINGS_ID } from "../schema";
import type { DinikDb, SyncMeta } from "../local/db";
import { hashRow } from "./hash";
import type { PushRecord, RemoteRecord, SyncRemote } from "./remote";
import {
  childrenOf,
  FILE_TABLE,
  OWN_DATA_TABLES,
  SYNC_TABLE_BY_NAME,
  SYNC_TABLES,
  type Row,
  type SyncTable,
} from "./tables";

/*
 * Two-way sync between this device's database and the cloud.
 *
 * How it stays consistent:
 * - Every change is saved on the device first. A sync compares each row with its fingerprint
 *   from the last sync (syncMeta), so nothing is missed: not a bulk edit, an import, a reset
 *   or a crash halfway through.
 * - The newer edit wins, on the device and in the cloud (the cloud refuses an older edit).
 *   A change made here counts as newer than the version it was made from.
 * - A deleted row leaves a marker, so the delete reaches every device. Deleting a habit also
 *   deletes its logs and targets everywhere.
 * - Two rows for the same thing (both devices logged "water" today offline) settle on one:
 *   the newer. Two habits with the same key keep both, the older one renamed.
 * - A first sign-in never mixes two separate sets of data: it uploads this device's data
 *   (empty account), takes the account's data, or asks which to keep.
 */

const TABLE_NAMES = SYNC_TABLES.map((t) => t.name);
/** Changes are read again from a minute before the last one seen, in case two saves overlapped. */
const OVERLAP_MS = 60_000;
/** Fingerprint for "deleted here, still to tell the cloud". */
const PENDING_DELETE = "pending-delete";

const ms = (iso: string) => Date.parse(iso);
const after = (iso: string) => new Date(ms(iso) + 1).toISOString();
const latest = (a: string, b: string) => (ms(a) >= ms(b) ? a : b);

export type LinkPlan = "linked" | "upload" | "take" | "choose";
/** upload: the account is empty; take: use the account's data; keep-device: replace the account's. */
export type LinkMode = "upload" | "take" | "keep-device";

export interface SyncResult {
  pulled: number;
  pushed: number;
  /** Something on this device changed (screens should reload their data). */
  changed: boolean;
  /** Records that couldn't be read (from a newer app version, or a missing file). */
  skipped: number;
}

interface Outgoing {
  tbl: string;
  id: string;
  row: Row | null;
  hash: string | null;
  stamp: string;
}

export interface SyncEngineOptions {
  db: DinikDb;
  remote: SyncRemote;
  now?: () => string;
  pageSize?: number;
  batchSize?: number;
}

export function createSyncEngine({
  db,
  remote,
  now = () => new Date().toISOString(),
  pageSize = 500,
  batchSize = 100,
}: SyncEngineOptions) {
  const dataAndMeta = [...TABLE_NAMES, "syncMeta"];
  const keyOf = (t: SyncTable, row: Record<string, unknown>) => String(row[t.key]);

  const getMeta = (tbl: string, id: string) => db.syncMeta.get([tbl, id]);
  const putMeta = (tbl: string, id: string, hash: string | null, at: string) =>
    db.syncMeta.put({ tbl, id, hash, at });

  /** When this device's version of a row counts as changed: never older than what it replaced. */
  function localStamp(row: Row, meta: SyncMeta | undefined) {
    if (!meta) return row.updatedAt;
    return latest(row.updatedAt, after(meta.at));
  }

  // ---------- reading the cloud's records into this device ----------

  /** Report-file contents for the records about to be applied (fetched outside a transaction). */
  async function fetchFiles(records: RemoteRecord[]) {
    const files = new Map<string, string>();
    for (const r of records) {
      if (r.tbl !== FILE_TABLE || r.deleted) continue;
      const local = (await db.reportFiles.get(r.id)) as Row | undefined;
      if (local && local.updatedAt === r.data.updatedAt && typeof local.data === "string") {
        files.set(r.id, local.data);
        continue;
      }
      try {
        files.set(r.id, await remote.getFile(r.id));
      } catch {
        // Missing in storage: the record is skipped (counted), the rest still syncs.
      }
    }
    return files;
  }

  function parse(t: SyncTable, r: RemoteRecord, files: Map<string, string>): Row | null {
    const data = t.name === FILE_TABLE ? { ...r.data, data: files.get(r.id) } : r.data;
    const parsed = t.schema.safeParse(data);
    return parsed.success ? (parsed.data as Row) : null;
  }

  /** Deletes the rows that belong to a deleted one (a habit's logs and targets…). */
  async function cascade(tbl: string, id: string) {
    for (const child of childrenOf(tbl)) {
      const field = child.parent!.field;
      const rows = (await db.table(child.name).where(field).equals(id).toArray()) as Row[];
      for (const row of rows) {
        await db.table(child.name).delete(keyOf(child, row));
        await cascade(child.name, keyOf(child, row));
      }
    }
  }

  function renamedKey(habit: Row) {
    const suffix = String(habit.id)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 6);
    return `${String(habit.key)}_${suffix}`;
  }

  /** Applies one cloud record. Must run inside a transaction on the data tables and syncMeta. */
  async function applyOne(r: RemoteRecord, files: Map<string, string>) {
    const t = SYNC_TABLE_BY_NAME.get(r.tbl);
    if (!t) return { changed: false, skipped: true };
    const table = db.table(t.name);
    const meta = await getMeta(t.name, r.id);
    const local = (await table.get(r.id)) as Row | undefined;
    const localHash = local ? hashRow(t.name, local) : null;
    const dirty = local ? meta?.hash !== localHash : meta != null && meta.hash !== null;

    if (r.deleted) {
      if (local && dirty && ms(localStamp(local, meta)) > ms(r.updated_at)) {
        // Changed here after it was deleted elsewhere: the change wins and goes back up.
        await putMeta(t.name, r.id, null, r.updated_at);
        return { changed: false, skipped: false };
      }
      await putMeta(t.name, r.id, null, r.updated_at);
      if (!local) return { changed: false, skipped: false };
      await table.delete(r.id);
      await cascade(t.name, r.id);
      return { changed: true, skipped: false };
    }

    const row = parse(t, r, files);
    if (!row) return { changed: false, skipped: true };
    const hash = hashRow(t.name, row);

    if (local && localHash === hash) {
      // Already the same (often my own change coming back): only note it if needed.
      if (meta?.hash !== hash || meta.at !== r.updated_at) {
        await putMeta(t.name, r.id, hash, r.updated_at);
      }
      return { changed: false, skipped: false };
    }
    if (local && dirty && ms(localStamp(local, meta)) > ms(r.updated_at)) {
      // My newer edit stays; it's sent up next.
      await putMeta(t.name, r.id, hash, r.updated_at);
      return { changed: false, skipped: false };
    }
    if (!local && dirty && meta && ms(r.updated_at) <= ms(meta.at)) {
      // Deleted here, and nobody changed it since: the delete stands.
      return { changed: false, skipped: false };
    }

    // Belongs to something that's been deleted: it goes too.
    if (t.parent) {
      const parentId = row[t.parent.field];
      if (typeof parentId === "string" && !(await db.table(t.parent.table).get(parentId))) {
        const parentMeta = await getMeta(t.parent.table, parentId);
        if (parentMeta && parentMeta.hash === null) {
          if (local) await table.delete(r.id);
          await putMeta(t.name, r.id, PENDING_DELETE, r.updated_at);
          return { changed: !!local, skipped: false };
        }
      }
    }

    // Two rows for the same thing.
    let toStore = row;
    if (t.unique) {
      const other = (await findUnique(t, row)) as Row | undefined;
      const otherId = other ? keyOf(t, other) : null;
      if (other && otherId !== r.id) {
        const otherMeta = await getMeta(t.name, otherId!);
        const otherStamp =
          otherMeta && otherMeta.hash === hashRow(t.name, other)
            ? otherMeta.at
            : localStamp(other, otherMeta);
        const incomingWins =
          ms(r.updated_at) > ms(otherStamp) ||
          (ms(r.updated_at) === ms(otherStamp) && r.id > otherId!);
        if (t.name === "habits") {
          // Keep both habits; the older one gets a new key.
          if (incomingWins) await table.put({ ...other, key: renamedKey(other) });
          else toStore = { ...row, key: renamedKey(row) };
        } else if (incomingWins) {
          await table.delete(otherId!);
        } else {
          await putMeta(t.name, r.id, PENDING_DELETE, r.updated_at);
          return { changed: false, skipped: false };
        }
      }
    }

    await table.put(toStore);
    // A renamed habit keeps the cloud's fingerprint, so the rename is sent up.
    await putMeta(t.name, r.id, hash, r.updated_at);
    return { changed: true, skipped: false };
  }

  function findUnique(t: SyncTable, row: Row) {
    const fields = t.unique!;
    const table = db.table(t.name);
    if (fields.length === 1)
      return table
        .where(fields[0])
        .equals(row[fields[0]] as string)
        .first();
    return table
      .where(`[${fields.join("+")}]`)
      .equals(fields.map((f) => row[f] as string))
      .first();
  }

  async function applyRecords(records: RemoteRecord[]) {
    const files = await fetchFiles(records);
    return db.transaction("rw", dataAndMeta, async () => {
      let changed = false;
      let skipped = 0;
      for (const r of records) {
        const res = await applyOne(r, files);
        changed ||= res.changed;
        if (res.skipped) skipped++;
      }
      return { changed, skipped };
    });
  }

  /** Reads the cloud's changes since `cursor`, a page at a time. */
  async function readChanges(
    cursor: string | null,
    onPage: (page: RemoteRecord[]) => Promise<void>,
  ) {
    let since = cursor ? new Date(ms(cursor) - OVERLAP_MS).toISOString() : null;
    let limit = pageSize;
    let max = cursor;
    let count = 0;
    for (;;) {
      const page = await remote.pull(since, limit);
      if (page.length === 0) break;
      await onPage(page);
      count += page.length;
      const first = page[0].synced_at;
      const last = page[page.length - 1].synced_at;
      if (!max || ms(last) > ms(max)) max = last;
      if (page.length < limit) break;
      if (ms(first) === ms(last))
        limit *= 2; // a whole page saved at the same moment
      else since = last;
    }
    return { max, count };
  }

  // ---------- sending this device's changes ----------

  async function outbox(force = false): Promise<Outgoing[]> {
    return db.transaction("r", dataAndMeta, async () => {
      const out: Outgoing[] = [];
      const stamp = now();
      for (const t of SYNC_TABLES) {
        const rows = (await db.table(t.name).toArray()) as Row[];
        const metas = new Map(
          (await db.syncMeta.where("tbl").equals(t.name).toArray()).map((m) => [m.id, m]),
        );
        for (const row of rows) {
          const id = keyOf(t, row);
          const meta = metas.get(id);
          metas.delete(id);
          const hash = hashRow(t.name, row);
          if (!force && meta?.hash === hash) continue;
          out.push({
            tbl: t.name,
            id,
            row,
            hash,
            stamp: force ? latest(stamp, meta ? after(meta.at) : stamp) : localStamp(row, meta),
          });
        }
        for (const meta of metas.values()) {
          if (meta.hash === null) continue;
          // A delete counts as just after the version it deleted, so an edit made elsewhere
          // in the meantime wins over it (nothing is lost without anyone seeing it).
          out.push({
            tbl: t.name,
            id: meta.id,
            row: null,
            hash: null,
            stamp: force ? latest(stamp, after(meta.at)) : after(meta.at),
          });
        }
      }
      return out;
    });
  }

  function toRemote(o: Outgoing): PushRecord {
    let data: Record<string, unknown> = {};
    if (o.row) {
      if (o.tbl === FILE_TABLE) {
        const { data: _contents, ...rest } = o.row;
        data = rest;
      } else data = o.row;
    }
    return { tbl: o.tbl, id: o.id, data, updated_at: o.stamp, deleted: !o.row };
  }

  async function send(out: Outgoing[]) {
    let pushed = 0;
    let changed = false;
    let skipped = 0;
    for (let i = 0; i < out.length; i += batchSize) {
      const batch = out.slice(i, i + batchSize);
      // A file's contents go to storage before its record, so no device sees a record
      // without its file.
      for (const o of batch) {
        if (o.tbl === FILE_TABLE && o.row) {
          await remote.putFile(o.id, String(o.row.data), String(o.row.mime));
        }
      }
      const stored = await remote.push(batch.map(toRemote));
      const byKey = new Map(stored.map((s) => [`${s.tbl}/${s.id}`, s]));
      const accepted: SyncMeta[] = [];
      const refused: RemoteRecord[] = [];
      for (const o of batch) {
        const s = byKey.get(`${o.tbl}/${o.id}`);
        if (!s) continue;
        if (s.deleted === !o.row && ms(s.updated_at) === ms(o.stamp)) {
          accepted.push({ tbl: o.tbl, id: o.id, hash: o.hash, at: s.updated_at });
          pushed++;
        } else refused.push(s); // the cloud had a newer edit: take it
      }
      await db.syncMeta.bulkPut(accepted);
      if (refused.length) {
        const res = await applyRecords(refused);
        changed ||= res.changed;
        skipped += res.skipped;
      }
      for (const o of batch) {
        if (o.tbl === FILE_TABLE && !o.row) await remote.removeFile(o.id).catch(() => undefined);
      }
    }
    return { pushed, changed, skipped };
  }

  // ---------- the public part ----------

  async function hasOwnData() {
    for (const name of OWN_DATA_TABLES) if ((await db.table(name).count()) > 0) return true;
    return false;
  }

  /** What signing in as `userId` on this device needs. */
  async function plan(userId: string): Promise<LinkPlan> {
    const state = await db.syncState.get("state");
    if (state?.userId === userId) return "linked";
    if ((await remote.countLive()) === 0) return "upload";
    return (await hasOwnData()) ? "choose" : "take";
  }

  /** Connects this device to the account, as `plan` said (or as chosen). Then call `sync`. */
  async function link(userId: string, mode: LinkMode): Promise<SyncResult> {
    if (mode === "upload") {
      await db.transaction("rw", ["syncMeta", "syncState"], async () => {
        await db.syncMeta.clear();
        await db.syncState.put({ key: "state", userId, cursor: null });
      });
      return sync();
    }

    // Everything in the account, read before anything here changes.
    const all = new Map<string, RemoteRecord>();
    const { max } = await readChanges(null, async (page) => {
      for (const r of page) all.set(`${r.tbl}/${r.id}`, r);
    });
    const records = [...all.values()];

    if (mode === "take") {
      const files = await fetchFiles(records);
      let skipped = 0;
      await db.transaction("rw", [...dataAndMeta, "syncState"], async () => {
        const settings = await db.settings.get(SETTINGS_ID);
        for (const name of TABLE_NAMES) await db.table(name).clear();
        await db.syncMeta.clear();
        for (const r of records) if ((await applyOne(r, files)).skipped) skipped++;
        // The app can't run without settings: keep this device's if the account has none.
        if (!(await db.settings.get(SETTINGS_ID)) && settings) await db.settings.put(settings);
        await db.syncState.put({ key: "state", userId, cursor: max });
      });
      const rest = await sync();
      return { ...rest, pulled: records.length, changed: true, skipped: rest.skipped + skipped };
    }

    // keep-device: this device's data replaces the account's.
    await db.transaction("rw", ["syncMeta", "syncState"], async () => {
      await db.syncMeta.clear();
      await db.syncMeta.bulkPut(
        records
          .filter((r) => !r.deleted)
          .map((r) => ({ tbl: r.tbl, id: r.id, hash: "account", at: r.updated_at })),
      );
      await db.syncState.put({ key: "state", userId, cursor: max });
    });
    const sent = await send(await outbox(true));
    return { pulled: 0, ...sent };
  }

  /** One full sync: read the cloud's changes, then send this device's. */
  async function sync(): Promise<SyncResult> {
    const state = await db.syncState.get("state");
    if (!state) throw new Error("This device isn't connected to an account.");
    let changed = false;
    let skipped = 0;
    const { max, count } = await readChanges(state.cursor, async (page) => {
      const res = await applyRecords(page);
      changed ||= res.changed;
      skipped += res.skipped;
    });
    if (max !== state.cursor) await db.syncState.update("state", { cursor: max });
    const sent = await send(await outbox());
    return {
      pulled: count,
      pushed: sent.pushed,
      changed: changed || sent.changed,
      skipped: skipped + sent.skipped,
    };
  }

  /** How many changes on this device the cloud doesn't have yet. */
  async function pendingCount() {
    return (await outbox()).length;
  }

  /** Forgets the account on this device (the data stays). */
  async function unlink() {
    await db.transaction("rw", ["syncMeta", "syncState"], async () => {
      await db.syncMeta.clear();
      await db.syncState.clear();
    });
  }

  return { plan, link, sync, pendingCount, unlink, linkedUser: () => db.syncState.get("state") };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
