import { describe, expect, it } from "vitest";
import { createActivity, fixOverlap, planOverlapFix, type ActivityDraft } from "./activity-ops";
import { setCheckIn } from "./checkin-ops";
import { isValidMetricNumber, setMetric, type MetricContext } from "./metric-ops";
import { makeTestStore } from "./test-utils";

async function setup() {
  const { store } = makeTestStore();
  const ctx: MetricContext = { store, dayStartHour: 4 };
  const habit = async (key: string) => (await store.habits.getByKey(key))!;
  const metric = async (date: string, key: Parameters<typeof store.metrics.listRange>[2]) =>
    (await store.metrics.listRange(date, date, key))[0];
  return { store, ctx, habit, metric };
}

describe("metrics and linked habits", () => {
  it("logging steps in the numbers panel scores the Daily steps habit", async () => {
    const { store, ctx, habit } = await setup();
    await setMetric(ctx, "2026-11-20", "steps", 3420);
    const steps = await habit("steps");
    expect(await store.habitLogs.get(steps.id, "2026-11-20")).toMatchObject({
      value: 3420,
      done: false,
      progress: 68.4,
    });

    await setMetric(ctx, "2026-11-20", "steps", null);
    expect(await store.habitLogs.get(steps.id, "2026-11-20")).toBeUndefined();
  });

  it("logging the habit saves the metric too (no double entry)", async () => {
    const { store, ctx, habit, metric } = await setup();
    const steps = await habit("steps");
    const targets = await store.habitTargets.listByHabit(steps.id);
    const saved = await setCheckIn(ctx, {
      habit: steps,
      targets,
      date: "2026-11-20",
      entry: { value: 6000, time: null },
      note: "Evening walk",
    });
    expect(saved).toMatchObject({ value: 6000, done: true, note: "Evening walk" });
    expect((await metric("2026-11-20", "steps"))?.valueNum).toBe(6000);

    const wake = await habit("wake_up");
    await setCheckIn(ctx, {
      habit: wake,
      targets: await store.habitTargets.listByHabit(wake.id),
      date: "2026-11-20",
      entry: { value: null, time: "07:20" },
    });
    expect((await metric("2026-11-20", "wake_time"))?.valueTime).toBe("07:20");
  });

  it("works out sleep hours from bed time the day before and wake time the next morning", async () => {
    const { store, ctx, habit, metric } = await setup();
    await setMetric(ctx, "2026-11-19", "bed_time", "23:30");
    expect(await metric("2026-11-20", "sleep_hours")).toBeUndefined();
    await setMetric(ctx, "2026-11-20", "wake_time", "07:30");
    expect((await metric("2026-11-20", "sleep_hours"))?.valueNum).toBe(8);

    // "Enough sleep" (target 7 h) reads the sleep hours.
    const sleep = await habit("sleep_hours");
    expect(await store.habitLogs.get(sleep.id, "2026-11-20")).toMatchObject({
      value: 8,
      done: true,
    });
    // "In bed on time" (23:30) is scored on the day you went to bed.
    const bed = await habit("bedtime");
    expect(await store.habitLogs.get(bed.id, "2026-11-19")).toMatchObject({
      time: "23:30",
      done: true,
    });

    // Changing the bed time updates the sleep; clearing it removes the worked-out hours.
    await setMetric(ctx, "2026-11-19", "bed_time", "00:30");
    expect((await metric("2026-11-20", "sleep_hours"))?.valueNum).toBe(7);
    await setMetric(ctx, "2026-11-19", "bed_time", null);
    expect(await metric("2026-11-20", "sleep_hours")).toBeUndefined();
  });

  it("keeps typed sleep hours when there is no bed/wake pair", async () => {
    const { ctx, metric } = await setup();
    await setMetric(ctx, "2026-11-20", "sleep_hours", 6.5);
    await setMetric(ctx, "2026-11-20", "wake_time", "07:00");
    expect((await metric("2026-11-20", "sleep_hours"))?.valueNum).toBe(6.5);
  });

  it("rejects values out of range and of the wrong kind", async () => {
    const { ctx } = await setup();
    expect(isValidMetricNumber("mood", 6)).toBe(false);
    expect(isValidMetricNumber("steps", 12.5)).toBe(false);
    expect(isValidMetricNumber("water", 2.5)).toBe(true);
    await expect(setMetric(ctx, "2026-11-20", "mood", 9)).rejects.toThrow();
    await expect(setMetric(ctx, "2026-11-20", "bed_time", 23)).rejects.toThrow();
  });
});

describe("fixing overlaps", () => {
  const draft = (categoryId: string, over: Partial<ActivityDraft>): ActivityDraft => ({
    title: "x",
    categoryId,
    subcategory: null,
    date: "2026-11-20",
    startTime: null,
    endTime: null,
    durationMinutes: null,
    place: null,
    people: [],
    notes: "",
    mood: null,
    energy: null,
    spend: null,
    tags: [],
    ...over,
  });

  it("plans a trim, a split or a removal", () => {
    const work = { startTime: "09:00", endTime: "17:00", durationMinutes: 480 };
    expect(
      planOverlapFix(work, { startTime: "13:00", endTime: "14:00", durationMinutes: 60 }, 4),
    ).toEqual({
      kind: "split",
      parts: [
        { startTime: "09:00", endTime: "13:00" },
        { startTime: "14:00", endTime: "17:00" },
      ],
    });
    expect(
      planOverlapFix(work, { startTime: "16:00", endTime: "18:00", durationMinutes: 120 }, 4),
    ).toEqual({
      kind: "trim",
      startTime: "09:00",
      endTime: "16:00",
    });
    expect(planOverlapFix(work, work, 4)).toEqual({ kind: "remove" });
  });

  it("splitting keeps both halves with the right durations", async () => {
    const { store, ctx } = await setup();
    const [cat] = await store.categories.list();
    const work = await createActivity(
      { ...ctx },
      draft(cat.id, { title: "Work", startTime: "09:00", endTime: "17:00" }),
    );
    const lunch = await createActivity(
      { ...ctx },
      draft(cat.id, { title: "Lunch", startTime: "13:00", endTime: "14:00" }),
    );
    await fixOverlap(ctx, work.id, lunch.id);
    const works = (await store.activities.list())
      .filter((a) => a.title === "Work")
      .map((a) => [a.startTime, a.endTime, a.durationMinutes]);
    expect(works.sort()).toEqual([
      ["09:00", "13:00", 240],
      ["14:00", "17:00", 180],
    ]);
  });
});
