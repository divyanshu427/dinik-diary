import { describe, expect, it } from "vitest";
import { InUseError } from "./local/local-store";
import {
  createHabit,
  createPhase,
  deletePhase,
  HabitLockedError,
  makeHabitKey,
  moveHabit,
  PhaseLockedError,
  placeHabit,
  reorderHabit,
  reorderPhase,
  setHabitArchived,
  updateHabit,
  type HabitDraft,
  type OpsContext,
} from "./habit-ops";
import type { Habit } from "./schema";
import { makeTestStore } from "./test-utils";

function setup(today = "2026-11-20") {
  const { store } = makeTestStore();
  const ctx: OpsContext = { store, today, dayStartHour: 4 };
  return { store, ctx };
}

async function phaseByNumber(ctx: OpsContext, n: number) {
  return (await ctx.store.phases.list()).find((p) => p.number === n)!;
}

const draft = (phaseId: string, overrides: Partial<HabitDraft> = {}): HabitDraft => ({
  name: "Lunch",
  description: "",
  type: "boolean",
  unit: "",
  direction: "higher_better",
  schedule: { kind: "daily" },
  partOfDay: "anytime",
  phaseId,
  categoryId: null,
  target: { targetValue: null, targetTime: null, graceMinutes: 0 },
  ...overrides,
});

const draftFrom = (h: Habit, target: HabitDraft["target"]): HabitDraft => ({
  name: h.name,
  description: h.description,
  type: h.type,
  unit: h.unit,
  direction: h.direction,
  schedule: h.schedule,
  partOfDay: h.partOfDay,
  phaseId: h.phaseId,
  categoryId: h.categoryId,
  target,
});

describe("habit keys", () => {
  it("are made from the name and kept unique", () => {
    expect(makeHabitKey("Drink water!", new Set())).toBe("drink_water");
    expect(makeHabitKey("Drink water", new Set(["drink_water"]))).toBe("drink_water_2");
    expect(makeHabitKey("🙂", new Set())).toBe("habit");
  });
});

describe("creating and moving habits", () => {
  it("adds a habit at the end of its phase, with a target starting today", async () => {
    const { store, ctx } = setup();
    const p1 = await phaseByNumber(ctx, 1);
    const lunch = await createHabit(ctx, draft(p1.id));

    const phase1 = await store.habits.listByPhase(p1.id);
    expect(phase1.at(-1)?.id).toBe(lunch.id);
    expect(lunch.key).toBe("lunch");
    expect(await store.habitTargets.listByHabit(lunch.id)).toMatchObject([
      { validFrom: "2026-11-20", validTo: null },
    ]);
  });

  it("moves a habit to the end of another phase once that phase is unlocked", async () => {
    const { store, ctx } = setup();
    const [p1, p2] = [await phaseByNumber(ctx, 1), await phaseByNumber(ctx, 2)];
    const lunch = await createHabit(ctx, draft(p1.id));

    // Phase 2 starts locked: moving in is refused and nothing changes.
    await expect(moveHabit(ctx, lunch.id, p2.id)).rejects.toBeInstanceOf(PhaseLockedError);
    expect((await store.habits.get(lunch.id))?.phaseId).toBe(p1.id);

    await store.phases.update(p2.id, { status: "active" });
    await moveHabit(ctx, lunch.id, p2.id);
    const phase2 = await store.habits.listByPhase(p2.id);
    expect(phase2.at(-1)?.id).toBe(lunch.id);
    expect((await store.habits.listByPhase(p1.id)).some((h) => h.id === lunch.id)).toBe(false);
  });

  it("drags out of a locked phase into an unlocked one, at an exact position", async () => {
    const { store, ctx } = setup();
    const [p1, p2] = [await phaseByNumber(ctx, 1), await phaseByNumber(ctx, 2)];
    const workout = (await store.habits.getByKey("workout"))!;
    expect(workout.phaseId).toBe(p2.id); // Phase 2 is locked; leaving it is fine

    await placeHabit(ctx, workout.id, p1.id, 2);
    const phase1 = (await store.habits.listByPhase(p1.id)).filter((h) => !h.archived);
    expect(phase1[2].id).toBe(workout.id);
    expect(phase1.map((h) => h.sortOrder)).toEqual(phase1.map((_, i) => i));
  });

  it("reorders by position inside a locked phase", async () => {
    const { store, ctx } = setup();
    const p2 = await phaseByNumber(ctx, 2);
    const [first, second] = await store.habits.listByPhase(p2.id);
    await placeHabit(ctx, first.id, p2.id, 1);
    const after = await store.habits.listByPhase(p2.id);
    expect(after.slice(0, 2).map((h) => h.id)).toEqual([second.id, first.id]);
  });

  it("reorders within a phase and skips archived habits", async () => {
    const { store, ctx } = setup();
    const p1 = await phaseByNumber(ctx, 1);
    const [first, second, third] = await store.habits.listByPhase(p1.id);
    await setHabitArchived(ctx, second.id, true);

    await reorderHabit(ctx, third.id, "up"); // jumps over the archived one
    const visible = (await store.habits.listByPhase(p1.id)).filter((h) => !h.archived);
    expect(visible.slice(0, 2).map((h) => h.id)).toEqual([third.id, first.id]);
  });

  it("does nothing when moving the first habit up", async () => {
    const { store, ctx } = setup();
    const p1 = await phaseByNumber(ctx, 1);
    const before = (await store.habits.listByPhase(p1.id)).map((h) => h.id);
    await reorderHabit(ctx, before[0], "up");
    expect((await store.habits.listByPhase(p1.id)).map((h) => h.id)).toEqual(before);
  });
});

describe("changing a target", () => {
  it("keeps old days' scores and re-scores today", async () => {
    const { store, ctx } = setup("2026-11-20");
    const steps = (await store.habits.getByKey("steps"))!;
    const log = (date: string) =>
      store.habitLogs.upsert(steps.id, date, {
        value: 6000,
        time: null,
        done: true,
        progress: 100,
      });
    await log("2026-11-19");
    await log("2026-11-20");

    // Raise the target from 5,000 to 8,000 today.
    await updateHabit(
      ctx,
      steps.id,
      draftFrom(steps, { targetValue: 8000, targetTime: null, graceMinutes: 0 }),
    );

    expect(await store.habitLogs.get(steps.id, "2026-11-19")).toMatchObject({
      done: true,
      progress: 100,
    });
    expect(await store.habitLogs.get(steps.id, "2026-11-20")).toMatchObject({
      done: false,
      progress: 75,
    });

    const targets = await store.habitTargets.listByHabit(steps.id);
    expect(targets.map((t) => [t.targetValue, t.validFrom, t.validTo])).toEqual([
      [5000, "2000-01-01", "2026-11-19"],
      [8000, "2026-11-20", null],
    ]);
  });

  it("changing it again the same day updates today's target instead of adding another", async () => {
    const { store, ctx } = setup();
    const steps = (await store.habits.getByKey("steps"))!;
    await updateHabit(
      ctx,
      steps.id,
      draftFrom(steps, { targetValue: 8000, targetTime: null, graceMinutes: 0 }),
    );
    await updateHabit(
      ctx,
      steps.id,
      draftFrom(steps, { targetValue: 9000, targetTime: null, graceMinutes: 0 }),
    );
    const targets = await store.habitTargets.listByHabit(steps.id);
    expect(targets.map((t) => t.targetValue)).toEqual([5000, 9000]);
  });

  it("an edit that doesn't touch the target adds no history", async () => {
    const { store, ctx } = setup();
    const steps = (await store.habits.getByKey("steps"))!;
    await updateHabit(ctx, steps.id, {
      ...draftFrom(steps, { targetValue: 5000, targetTime: null, graceMinutes: 0 }),
      name: "Walk",
    });
    expect(await store.habitTargets.listByHabit(steps.id)).toHaveLength(1);
    expect((await store.habits.get(steps.id))?.name).toBe("Walk");
  });
});

describe("locking how a habit is measured", () => {
  it("refuses to change the type once there are check-ins, and changes nothing", async () => {
    const { store, ctx } = setup();
    const bath = (await store.habits.getByKey("bath"))!;
    await store.habitLogs.upsert(bath.id, "2026-11-19", {
      value: 1,
      time: null,
      done: true,
      progress: 100,
    });

    await expect(
      updateHabit(ctx, bath.id, {
        ...draftFrom(bath, { targetValue: 2, targetTime: null, graceMinutes: 0 }),
        name: "Two baths",
        type: "count",
      }),
    ).rejects.toBeInstanceOf(HabitLockedError);
    expect(await store.habits.get(bath.id)).toMatchObject({ name: "Bath", type: "boolean" });
  });

  it("allows changing the type while there are no check-ins", async () => {
    const { store, ctx } = setup();
    const bath = (await store.habits.getByKey("bath"))!;
    const updated = await updateHabit(ctx, bath.id, {
      ...draftFrom(bath, { targetValue: 2, targetTime: null, graceMinutes: 0 }),
      type: "count",
    });
    expect(updated.type).toBe("count");
  });
});

describe("phases", () => {
  it("adds a new phase at the end, locked", async () => {
    const { ctx } = setup();
    const phase = await createPhase(ctx, { name: "Summer", description: "" });
    expect(phase).toMatchObject({ number: 6, status: "locked" });
  });

  it("swaps a phase with its neighbour", async () => {
    const { ctx } = setup();
    const p2 = await phaseByNumber(ctx, 2);
    await reorderPhase(ctx, p2.id, "up");
    expect((await phaseByNumber(ctx, 1)).id).toBe(p2.id);
  });

  it("won't delete a phase that has habits", async () => {
    const { ctx } = setup();
    const p1 = await phaseByNumber(ctx, 1);
    await expect(deletePhase(ctx, p1.id)).rejects.toBeInstanceOf(InUseError);
  });

  it("deletes an empty phase and renumbers the rest", async () => {
    const { store, ctx } = setup();
    const extra = await createPhase(ctx, { name: "Extra", description: "" });
    const p6 = extra; // number 6
    await store.phases.update(p6.id, { status: "active" });
    const p3 = await phaseByNumber(ctx, 3);
    // Empty Phase 3 by moving its habits away, then delete it.
    for (const h of await store.habits.listByPhase(p3.id)) await moveHabit(ctx, h.id, p6.id);
    await deletePhase(ctx, p3.id);
    const numbers = (await store.phases.list()).map((p) => p.number).sort();
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });
});
