import { describe, expect, it } from "vitest";
import { parseBackup, type BackupFile } from "./backup";
import type { DataStore } from "./repositories";
import { makeTestStore } from "./test-utils";

/** Adds one of everything so the round trip covers every table. */
async function addSampleData(store: DataStore) {
  const habit = (await store.habits.getByKey("brush_morning"))!;
  const travel = (await store.categories.list()).find((c) => c.name === "Travel and exploration")!;
  await store.habitLogs.upsert(habit.id, "2026-11-19", {
    value: null,
    time: "08:10",
    done: true,
    progress: 100,
  });
  await store.metrics.upsert("2026-11-19", "steps", { valueNum: 6400, valueTime: null });
  await store.dayStatus.set("2026-11-18", { type: "rest", note: "" });
  await store.activities.create({
    title: "Visited the fort",
    categoryId: travel.id,
    subcategory: "Local exploration",
    date: "2026-11-19",
    startTime: "17:00",
    endTime: "19:00",
    durationMinutes: 120,
    place: "Fort",
    people: [],
    notes: "",
    mood: 4,
    energy: 3,
    spend: 50,
    tags: ["solo"],
    source: "web",
    rawMessageId: null,
    aiConfidence: null,
    confirmed: true,
  });
  const concern = await store.concerns.create({
    title: "Hair fall",
    description: "",
    kind: "concern",
    bodyArea: "",
    severity: 4,
    status: "active",
    startedAt: "2026-11-01",
    worseWith: "",
    helpsWith: "",
    triedSoFar: "",
    notes: "",
    linkedHabitIds: [habit.id],
    strainHabitIds: [],
    adjustments: [],
    dismissed: [],
  });
  await store.concernUpdates.create({
    concernId: concern.id,
    date: "2026-11-15",
    severity: 3,
    note: "",
    photoRef: null,
  });
  await store.settings.update({ themePreset: "mono" });
}

const withoutExportTime = (f: BackupFile) => ({ ...f, exportedAt: "" });

describe("backup", () => {
  it("export → import into a fresh store → export again gives identical data", async () => {
    const a = makeTestStore().store;
    await addSampleData(a);
    const exported = await a.exportAll();

    const parsed = parseBackup(JSON.stringify(exported));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const b = makeTestStore().store;
    await b.importAll(parsed.file);
    const reExported = await b.exportAll();

    expect(withoutExportTime(reExported)).toEqual(withoutExportTime(exported));
  });

  it("restores data after a reset", async () => {
    const { store } = makeTestStore();
    await addSampleData(store);
    const backup = await store.exportAll();

    await store.resetToDefaults();
    expect((await store.counts()).activities).toBe(0);

    await store.importAll(backup);
    expect(withoutExportTime(await store.exportAll())).toEqual(withoutExportTime(backup));
  });

  describe("rejects broken files with a readable reason", () => {
    const valid = async () => {
      const { store } = makeTestStore();
      await addSampleData(store);
      return store.exportAll();
    };

    it("not JSON", () => {
      expect(parseBackup("{oops")).toEqual({ ok: false, errors: ["This file isn't valid JSON."] });
    });

    it("some other app's file", () => {
      expect(parseBackup('{"app":"other"}')).toEqual({
        ok: false,
        errors: ["This isn't a Dinik Diary backup file."],
      });
    });

    it("a field with the wrong format", async () => {
      const file = await valid();
      file.data.habitLogs[0].date = "19/11/2026";
      const result = parseBackup(JSON.stringify(file));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0]).toMatch(/data\.habitLogs\.0\.date/);
    });

    it("a reference to a row that doesn't exist", async () => {
      const file = await valid();
      file.data.habitLogs[0].habitId = "ghost";
      const result = parseBackup(JSON.stringify(file));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.join(" ")).toMatch(/habitId points to a missing row/);
    });

    it("duplicate habit keys", async () => {
      const file = await valid();
      file.data.habits[1].key = file.data.habits[0].key;
      const result = parseBackup(JSON.stringify(file));
      expect(result.ok).toBe(false);
    });
  });

  it("an import that fails halfway changes nothing (all-or-nothing)", async () => {
    const { store } = makeTestStore();
    await addSampleData(store);
    const before = await store.exportAll();

    // Bypass the checks to force a database error mid-import (duplicate unique key).
    const bad = structuredClone(before);
    bad.data.habits[1].key = bad.data.habits[0].key;
    await expect(store.importAll(bad)).rejects.toThrow();

    expect(withoutExportTime(await store.exportAll())).toEqual(withoutExportTime(before));
  });

  it("reset keeps the theme but restores starter data", async () => {
    const { store } = makeTestStore();
    await addSampleData(store);
    await store.resetToDefaults();
    const counts = await store.counts();
    expect(counts).toMatchObject({
      phases: 5,
      categories: 15,
      habitLogs: 0,
      activities: 0,
      concerns: 0,
    });
    expect((await store.settings.get()).themePreset).toBe("mono");
  });
});
