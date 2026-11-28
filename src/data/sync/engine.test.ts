import { beforeEach, describe, expect, it } from "vitest";
import { DinikDb } from "../local/db";
import { createLocalDataStore } from "../local/local-store";
import type { DataStore } from "../repositories";
import { createSyncEngine, type SyncEngine } from "./engine";
import { MemoryRemote } from "./memory-remote";

/*
 * Two (or three) devices and one cloud. After syncing, every device must hold exactly the
 * same data, whatever order things happened in.
 */

let clock = 0;
const now = () => new Date((clock += 1000)).toISOString();
let n = 0;

interface Device {
  db: DinikDb;
  store: DataStore;
  engine: SyncEngine;
}

function device(remote: MemoryRemote): Device {
  const db = new DinikDb(`sync-test-${++n}-${Math.random().toString(36).slice(2)}`);
  const store = createLocalDataStore({ db, now, newId: () => crypto.randomUUID() });
  // Small pages and batches, so paging is exercised too.
  const engine = createSyncEngine({ db, remote, now, pageSize: 7, batchSize: 5 });
  return { db, store, engine };
}

/** Everything a device holds, in a fixed order (for comparing devices). */
async function dump(d: Device) {
  const { data } = await d.store.exportAll();
  const sorted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const key = (row: object) => {
      const r = row as { id?: string; date?: string };
      return String(r.id ?? r.date);
    };
    sorted[k] = Array.isArray(v) ? [...v].sort((a, b) => key(a).localeCompare(key(b))) : v;
  }
  return sorted;
}

async function expectSame(a: Device, b: Device) {
  expect(await dump(b)).toEqual(await dump(a));
  expect(await a.engine.pendingCount()).toBe(0);
  expect(await b.engine.pendingCount()).toBe(0);
}

const USER = "user-1";
const LOG = { value: null, time: null, done: true, progress: 100 };

async function habitByKey(d: Device, key: string) {
  const h = await d.store.habits.getByKey(key);
  if (!h) throw new Error(`no habit ${key}`);
  return h;
}

/** Device A with data in the cloud, and device B signed in to the same account. */
async function twoDevices() {
  const remote = new MemoryRemote();
  const a = device(remote);
  expect(await a.engine.plan(USER)).toBe("upload");
  await a.engine.link(USER, "upload");
  const b = device(remote);
  expect(await b.engine.plan(USER)).toBe("take");
  await b.engine.link(USER, "take");
  return { remote, a, b };
}

const activity = (title: string, date = "2026-11-28") => ({
  title,
  categoryId: "x",
  subcategory: null,
  date,
  startTime: null,
  endTime: null,
  durationMinutes: 30,
  place: null,
  people: [],
  notes: "",
  mood: null,
  energy: null,
  spend: null,
  tags: [],
  source: "web" as const,
  rawMessageId: null,
  aiConfidence: null,
  confirmed: true,
});

beforeEach(() => {
  clock = Date.UTC(2026, 10, 28, 8, 0, 0);
});

describe("sync: first sign-in", () => {
  it("uploads everything when the account is empty", async () => {
    const remote = new MemoryRemote();
    const a = device(remote);
    const result = await a.engine.link(USER, "upload");
    const counts = await a.store.counts();
    expect(result.pushed).toBe(Object.values(counts).reduce((sum, c) => sum + c, 0));
    expect(remote.live("habits")).toHaveLength(counts.habits);
    expect(await a.engine.pendingCount()).toBe(0);
  });

  it("a second device with only starter data takes the account's data (no duplicates)", async () => {
    const { a, b, remote } = await twoDevices();
    await expectSame(a, b);
    // The second device's own starter habits were replaced, not added.
    expect(remote.live("habits")).toHaveLength((await a.store.counts()).habits);
    expect(remote.live("settings")).toHaveLength(1);
  });

  it("asks which to keep when both the device and the account have real data", async () => {
    const { a, remote } = await twoDevices();
    const c = device(remote);
    await c.store.activities.create(activity("Only on C"));
    expect(await c.engine.plan(USER)).toBe("choose");
    expect(await a.engine.plan(USER)).toBe("linked");
  });

  it("keep this device: its data replaces the account's on every device", async () => {
    const { a, remote } = await twoDevices();
    await a.store.activities.create(activity("Only on A"));
    await a.engine.sync();

    const c = device(remote);
    await c.store.activities.create(activity("Only on C"));
    await c.engine.link(USER, "keep-device");
    await a.engine.sync();

    await expectSame(a, c);
    expect((await a.store.activities.list()).map((x) => x.title)).toEqual(["Only on C"]);
  });

  it("use the account: this device's data is replaced", async () => {
    const { a, remote } = await twoDevices();
    await a.store.activities.create(activity("From the account"));
    await a.engine.sync();

    const c = device(remote);
    await c.store.activities.create(activity("Thrown away"));
    await c.engine.link(USER, "take");
    await expectSame(a, c);
    expect((await c.store.activities.list()).map((x) => x.title)).toEqual(["From the account"]);
  });
});

describe("sync: changes", () => {
  it("a change on one device shows on the other", async () => {
    const { a, b } = await twoDevices();
    const water = await habitByKey(a, "morning_water");
    await a.store.habitLogs.upsert(water.id, "2026-11-28", LOG);
    await a.store.metrics.upsert("2026-11-28", "weight", { valueNum: 71.5, valueTime: null });
    await a.store.dayStatus.set("2026-11-28", { type: "rest", note: "" });
    await a.store.settings.update({ unlockThreshold: 70 });
    await a.engine.sync();
    const res = await b.engine.sync();
    expect(res.changed).toBe(true);
    await expectSame(a, b);
    expect(await b.store.habitLogs.get(water.id, "2026-11-28")).toMatchObject({ done: true });
    expect((await b.store.settings.get()).unlockThreshold).toBe(70);
  });

  it("nothing to do when nothing changed", async () => {
    const { a, b } = await twoDevices();
    expect(await a.engine.sync()).toMatchObject({ pushed: 0, changed: false });
    expect(await b.engine.sync()).toMatchObject({ pushed: 0, changed: false });
  });

  it("the newer edit wins when both devices change the same thing offline", async () => {
    const { a, b } = await twoDevices();
    const act = await a.store.activities.create(activity("Walk"));
    await a.engine.sync();
    await b.engine.sync();

    await a.store.activities.update(act.id, { title: "Walk (A)" });
    await b.store.activities.update(act.id, { title: "Walk (B, later)" });
    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();
    await expectSame(a, b);
    expect((await a.store.activities.get(act.id))?.title).toBe("Walk (B, later)");
  });

  it("an older edit that arrives late doesn't undo a newer one", async () => {
    const { a, b } = await twoDevices();
    const act = await a.store.activities.create(activity("Read"));
    await a.engine.sync();
    await b.engine.sync();

    await b.store.activities.update(act.id, { title: "Read (B, earlier)" });
    await a.store.activities.update(act.id, { title: "Read (A, later)" });
    // A syncs first, B's older edit arrives after: the cloud refuses it, B takes A's.
    await a.engine.sync();
    const res = await b.engine.sync();
    expect(res.changed).toBe(true);
    await a.engine.sync();
    await expectSame(a, b);
    expect((await b.store.activities.get(act.id))?.title).toBe("Read (A, later)");
  });

  it("both devices log the same habit on the same day offline: one log is kept", async () => {
    const { a, b } = await twoDevices();
    const water = await habitByKey(a, "morning_water");
    await a.store.habitLogs.upsert(water.id, "2026-11-28", {
      ...LOG,
      done: false,
      progress: 50,
      value: 1,
    });
    await b.store.habitLogs.upsert(water.id, "2026-11-28", { ...LOG, value: 2 });
    await a.store.metrics.upsert("2026-11-28", "mood", { valueNum: 4, valueTime: null });
    await b.store.metrics.upsert("2026-11-28", "mood", { valueNum: 2, valueTime: null });

    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();
    await b.engine.sync();
    await expectSame(a, b);
    const logs = (await a.store.habitLogs.listByHabit(water.id)).filter(
      (l) => l.date === "2026-11-28",
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].value).toBe(2); // B's was later
    expect((await a.store.metrics.listByDate("2026-11-28"))[0].valueNum).toBe(2);
  });

  it("two new habits with the same key: both are kept, the older renamed", async () => {
    const { a, b } = await twoDevices();
    const base = await habitByKey(a, "morning_water");
    const draft = { ...base, id: undefined, key: "guitar", name: "Guitar", sortOrder: 90 };
    delete (draft as { id?: string }).id;
    await a.store.habits.create({ ...draft, name: "Guitar (A)" });
    await b.store.habits.create({ ...draft, name: "Guitar (B)" });
    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();
    await b.engine.sync();
    await expectSame(a, b);
    const names = (await a.store.habits.list()).filter((h) => h.name.startsWith("Guitar"));
    expect(names).toHaveLength(2);
    expect(names.find((h) => h.name === "Guitar (B)")?.key).toBe("guitar");
    expect(names.find((h) => h.name === "Guitar (A)")?.key).toMatch(/^guitar_/);
  });
});

describe("sync: deletes", () => {
  it("a delete reaches the other device", async () => {
    const { a, b } = await twoDevices();
    const act = await a.store.activities.create(activity("Gone soon"));
    await a.engine.sync();
    await b.engine.sync();
    await a.store.activities.remove(act.id);
    await a.engine.sync();
    await b.engine.sync();
    await expectSame(a, b);
    expect(await b.store.activities.get(act.id)).toBeUndefined();
  });

  it("deleting a habit deletes its logs and targets on the other device too", async () => {
    const { a, b } = await twoDevices();
    const habit = await habitByKey(a, "bath");
    await a.store.habitLogs.upsert(habit.id, "2026-11-27", LOG);
    await a.engine.sync();
    await b.engine.sync();
    // B logs it again while A deletes the habit.
    await b.store.habitLogs.upsert(habit.id, "2026-11-28", LOG);
    await a.store.habits.remove(habit.id);
    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();
    await expectSame(a, b);
    expect(await b.store.habits.get(habit.id)).toBeUndefined();
    expect(await b.store.habitLogs.listByHabit(habit.id)).toEqual([]);
    expect(await b.store.habitTargets.listByHabit(habit.id)).toEqual([]);
  });

  it("a log that arrives after its habit was deleted is removed everywhere", async () => {
    const { a, b } = await twoDevices();
    const habit = await habitByKey(a, "bath");
    // B logs and syncs first; A then deletes the habit without having seen B's log.
    await b.store.habitLogs.upsert(habit.id, "2026-11-28", LOG);
    await b.engine.sync();
    await a.store.habits.remove(habit.id);
    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();
    await expectSame(a, b);
    expect(await a.store.habitLogs.listByHabit(habit.id)).toEqual([]);
  });

  it("an edit made after the delete brings it back", async () => {
    const { a, b } = await twoDevices();
    const act = await a.store.activities.create(activity("Keep me"));
    await a.engine.sync();
    await b.engine.sync();
    await a.store.activities.remove(act.id);
    await b.store.activities.update(act.id, { notes: "edited later" });
    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();
    await expectSame(a, b);
    expect((await a.store.activities.get(act.id))?.notes).toBe("edited later");
  });

  it("importing a backup or resetting replaces the account's data too", async () => {
    const { a, b } = await twoDevices();
    await a.store.activities.create(activity("Before the backup"));
    const backup = await a.store.exportAll();
    await a.store.activities.create(activity("After the backup"));
    await a.engine.sync();
    await b.engine.sync();

    await b.store.importAll(backup);
    await b.engine.sync();
    await a.engine.sync();
    await expectSame(a, b);
    expect((await a.store.activities.list()).map((x) => x.title)).toEqual(["Before the backup"]);

    await a.store.resetToDefaults();
    await a.engine.sync();
    await b.engine.sync();
    await expectSame(a, b);
    expect(await b.store.activities.list()).toEqual([]);
  });
});

describe("sync: offline and files", () => {
  it("keeps changes made offline and sends them when back online", async () => {
    const { a, b, remote } = await twoDevices();
    remote.offline = true;
    await a.store.activities.create(activity("On the train"));
    await expect(a.engine.sync()).rejects.toThrow();
    expect(await a.engine.pendingCount()).toBe(1);
    remote.offline = false;
    await a.engine.sync();
    await b.engine.sync();
    await expectSame(a, b);
  });

  it("report files go to file storage and arrive whole on the other device", async () => {
    const { a, b, remote } = await twoDevices();
    const report = await a.store.healthReports.create({
      date: "2026-11-20",
      title: "Blood test",
      type: "blood-test",
      doctor: "",
      notes: "",
      concernIds: [],
    });
    const file = await a.store.reportFiles.create({
      reportId: report.id,
      name: "scan.png",
      mime: "image/png",
      size: 4,
      data: "data:image/png;base64,AAAA",
    });
    await a.engine.sync();
    // The cloud record has no contents; storage has them.
    expect(remote.live("reportFiles")[0].data.data).toBeUndefined();
    expect(remote.files.get(file.id)).toBe(file.data);
    await b.engine.sync();
    await expectSame(a, b);

    await b.store.reportFiles.remove(file.id);
    await b.store.healthReports.remove(report.id);
    await b.engine.sync();
    await a.engine.sync();
    await expectSame(a, b);
    expect(remote.files.has(file.id)).toBe(false);
  });

  it("three devices stay the same after a busy day", async () => {
    const { a, b, remote } = await twoDevices();
    const c = device(remote);
    await c.engine.link(USER, "take");
    const habits = (await a.store.habits.list()).slice(0, 6);
    for (const [i, h] of habits.entries()) {
      const d = [a, b, c][i % 3];
      await d.store.habitLogs.upsert(h.id, "2026-11-28", LOG);
      await d.store.activities.create(activity(`Activity ${i}`));
    }
    await b.store.habits.remove(habits[1].id);
    await c.store.settings.update({ windowDays: 10 });
    for (let round = 0; round < 2; round++) {
      for (const d of [a, b, c]) await d.engine.sync();
    }
    await expectSame(a, b);
    await expectSame(b, c);
    expect((await c.store.settings.get()).windowDays).toBe(10);
  });
});
