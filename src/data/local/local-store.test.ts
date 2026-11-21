import { describe, expect, it } from "vitest";
import { NotFoundError } from "../repositories";
import { makeTestStore } from "../test-utils";
import { InUseError } from "./local-store";

const LOG = { value: null, time: null, done: true, progress: 100 };

async function firstHabit(store: ReturnType<typeof makeTestStore>["store"]) {
  const habit = await store.habits.getByKey("bath");
  if (!habit) throw new Error("seed missing");
  return habit;
}

describe("local data store", () => {
  it("loads the starter data the first time it opens", async () => {
    const { store } = makeTestStore();
    const counts = await store.counts();
    expect(counts).toMatchObject({ phases: 5, categories: 15, settings: 1, habitLogs: 0 });
    expect(counts.habits).toBeGreaterThanOrEqual(38);
  });

  it("keeps the theme the user already picked when seeding", async () => {
    const { store } = makeTestStore({ getTheme: () => ({ preset: "mono", mode: "dark" }) });
    expect(await store.settings.get()).toMatchObject({ themePreset: "mono", colorMode: "dark" });
  });

  describe("create / read / update / delete", () => {
    it("creates with id and timestamps, updates without touching createdAt", async () => {
      const { store } = makeTestStore();
      const created = await store.categories.create({
        name: "Volunteering",
        parentId: null,
        colorToken: "chart-other",
        customColor: null,
        icon: "heart",
        archived: false,
        sortOrder: 99,
      });
      expect(created.id).toMatch(/^id-/);
      expect(await store.categories.get(created.id)).toEqual(created);

      const updated = await store.categories.update(created.id, { name: "Volunteer work" });
      expect(updated.name).toBe("Volunteer work");
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.updatedAt > created.updatedAt).toBe(true);

      await store.categories.remove(created.id);
      expect(await store.categories.get(created.id)).toBeUndefined();
    });

    it("rejects invalid data and writes nothing", async () => {
      const { store } = makeTestStore();
      const before = (await store.counts()).categories;
      await expect(
        // @ts-expect-error -- deliberately invalid
        store.categories.create({ name: "", colorToken: "purple" }),
      ).rejects.toThrow();
      expect((await store.counts()).categories).toBe(before);
    });

    it("throws NotFoundError when updating a missing row", async () => {
      const { store } = makeTestStore();
      await expect(store.phases.update("nope", { name: "x" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("refuses a second habit with the same key", async () => {
      const { store } = makeTestStore();
      const bath = await firstHabit(store);
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = bath;
      await expect(store.habits.create(rest)).rejects.toThrow();
    });
  });

  describe("habit logs", () => {
    it("keeps one log per habit per day (upsert)", async () => {
      const { store } = makeTestStore();
      const habit = await firstHabit(store);
      const first = await store.habitLogs.upsert(habit.id, "2026-11-19", {
        ...LOG,
        done: false,
        progress: 0,
      });
      const second = await store.habitLogs.upsert(habit.id, "2026-11-19", LOG);
      expect(second.id).toBe(first.id);
      expect(second.done).toBe(true);
      expect(await store.habitLogs.listByDate("2026-11-19")).toHaveLength(1);
    });

    it("lists a date range, inclusive", async () => {
      const { store } = makeTestStore();
      const habit = await firstHabit(store);
      for (const d of ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]) {
        await store.habitLogs.upsert(habit.id, d, LOG);
      }
      const rows = await store.habitLogs.listRange("2026-11-18", "2026-11-19");
      expect(rows.map((r) => r.date).sort()).toEqual(["2026-11-18", "2026-11-19"]);
    });

    it("rejects an invalid progress value", async () => {
      const { store } = makeTestStore();
      const habit = await firstHabit(store);
      await expect(
        store.habitLogs.upsert(habit.id, "2026-11-19", { ...LOG, progress: 140 }),
      ).rejects.toThrow();
    });
  });

  it("keeps one value per metric per day", async () => {
    const { store } = makeTestStore();
    await store.metrics.upsert("2026-11-19", "steps", { valueNum: 3000, valueTime: null });
    await store.metrics.upsert("2026-11-19", "steps", { valueNum: 6200, valueTime: null });
    await store.metrics.upsert("2026-11-19", "wake_time", { valueNum: null, valueTime: "07:40" });
    const rows = await store.metrics.listByDate("2026-11-19");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.key === "steps")?.valueNum).toBe(6200);
  });

  it("stores day status (rest / sick / travel)", async () => {
    const { store } = makeTestStore();
    await store.dayStatus.set("2026-11-19", { type: "sick", note: "fever" });
    expect(await store.dayStatus.get("2026-11-19")).toMatchObject({ type: "sick", note: "fever" });
  });

  it("deleting a habit also deletes its targets and logs", async () => {
    const { store } = makeTestStore();
    const habit = await firstHabit(store);
    await store.habitLogs.upsert(habit.id, "2026-11-19", LOG);
    await store.habits.remove(habit.id);
    expect(await store.habitTargets.listByHabit(habit.id)).toEqual([]);
    expect(await store.habitLogs.listByDate("2026-11-19")).toEqual([]);
  });

  it("won't delete a phase or category that is still in use", async () => {
    const { store } = makeTestStore();
    const habit = await firstHabit(store);
    await expect(store.phases.remove(habit.phaseId)).rejects.toBeInstanceOf(InUseError);
    await expect(store.categories.remove(habit.categoryId!)).rejects.toBeInstanceOf(InUseError);
  });

  it("updates settings but never the seed date", async () => {
    const { store } = makeTestStore();
    const before = await store.settings.get();
    const after = await store.settings.update({ themePreset: "mono", dayStartHour: 5 });
    expect(after).toMatchObject({
      themePreset: "mono",
      dayStartHour: 5,
      seededAt: before.seededAt,
    });
    await expect(store.settings.update({ dayStartHour: 30 })).rejects.toThrow();
  });
});
