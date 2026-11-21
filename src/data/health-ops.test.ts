import { describe, expect, it } from "vitest";
import { summarizeDay, targetOn } from "@/lib/core";
import type { OpsContext } from "./habit-ops";
import {
  applyChange,
  checkIn,
  createHealthIssue,
  endAdjustment,
  markSickDay,
  setDayNote,
  setHealthStatus,
  type HealthIssueDraft,
} from "./health-ops";
import { makeTestStore } from "./test-utils";

const today = "2026-11-21";
const lower = (targetValue: number) => ({
  mode: "lower" as const,
  values: { targetValue, targetTime: null, graceMinutes: 0 },
});

async function setup() {
  const { store } = makeTestStore();
  const ctx: OpsContext = { store, today, dayStartHour: 4 };
  const habit = async (key: string) => (await store.habits.getByKey(key))!;
  const target = async (key: string, date: string) =>
    targetOn(await store.habitTargets.listByHabit((await habit(key)).id), date)?.targetValue;
  const draft = (over: Partial<HealthIssueDraft> = {}): HealthIssueDraft => ({
    title: "Back pain",
    kind: "pain",
    note: "after lifting a bag",
    bodyArea: "Lower back",
    startedAt: "2026-11-18",
    severity: 6,
    worseWith: "sitting for hours",
    helpsWith: "stretching",
    triedSoFar: "",
    notes: "",
    linkedHabitIds: [],
    strainHabitIds: [],
    ...over,
  });
  return { store, ctx, habit, target, draft };
}

describe("health issues and check-ins", () => {
  it("adding an issue records today's level; a second check-in the same day replaces it", async () => {
    const { store, ctx, draft } = await setup();
    const issue = await createHealthIssue(ctx, draft({ title: "  Back pain " }));
    expect(issue).toMatchObject({ title: "Back pain", kind: "pain", status: "active" });
    await checkIn(ctx, issue.id, today, 4, "better after a walk");
    await checkIn(ctx, issue.id, "2026-11-20", 7);
    const updates = await store.concernUpdates.listByConcern(issue.id);
    expect(updates.map((u) => [u.date, u.severity, u.note])).toEqual([
      ["2026-11-20", 7, ""],
      [today, 4, "better after a walk"],
    ]);
    // The first check-in kept the note given when adding the issue, until it was replaced.
  });

  it("a habit can't both help and make it worse", async () => {
    const { ctx, draft } = await setup();
    const issue = await createHealthIssue(
      ctx,
      draft({ linkedHabitIds: ["a"], strainHabitIds: ["a", "b"] }),
    );
    expect(issue.strainHabitIds).toEqual(["b"]);
  });

  it("day notes and sick days keep each other", async () => {
    const { store, ctx } = await setup();
    await setDayNote(ctx, today, " headache in the evening ");
    await markSickDay(ctx, today);
    expect(await store.dayStatus.get(today)).toMatchObject({
      type: "sick",
      note: "headache in the evening",
    });
  });
});

describe("changing a habit for a few days", () => {
  it("a higher target (water 3 → 3.5 L) also goes back by itself", async () => {
    const { ctx, habit, target, draft, store } = await setup();
    const water = await habit("water_goal");
    const issue = await createHealthIssue(ctx, draft({ title: "Headache" }));
    const a = await applyChange(
      ctx,
      issue.id,
      water.id,
      { mode: "raise", values: { targetValue: 3.5, targetTime: null, graceMinutes: 0 } },
      5,
    );
    expect(a.kind).toBe("raise");
    expect(await target("water_goal", today)).toBe(3.5);
    expect(await target("water_goal", "2026-11-26")).toBe(3);
    expect((await store.concerns.get(issue.id))!.adjustments).toHaveLength(1);
  });

  it("a lighter target for 5 days, then the old one by itself; ending early restores it today", async () => {
    const { store, ctx, habit, target, draft } = await setup();
    const workout = await habit("workout");
    const issue = await createHealthIssue(ctx, draft({ strainHabitIds: [workout.id] }));

    const a = await applyChange(ctx, issue.id, workout.id, lower(15), 5);
    expect(a).toMatchObject({ kind: "ease", from: today, to: "2026-11-25" });
    expect(await target("workout", "2026-11-20")).toBe(30);
    expect(await target("workout", today)).toBe(15);
    expect(await target("workout", "2026-11-25")).toBe(15);
    expect(await target("workout", "2026-11-26")).toBe(30);

    await endAdjustment({ ...ctx, today: "2026-11-23" }, issue.id, a.id);
    expect(await target("workout", "2026-11-22")).toBe(15); // the past stays as it was
    expect(await target("workout", "2026-11-23")).toBe(30);
    expect((await store.concerns.get(issue.id))!.adjustments[0].endedOn).toBe("2026-11-23");
  });

  it("ending on the first day removes the lighter target completely", async () => {
    const { ctx, habit, target, draft } = await setup();
    const workout = await habit("workout");
    const issue = await createHealthIssue(ctx, draft());
    const a = await applyChange(ctx, issue.id, workout.id, lower(15), 5);
    await endAdjustment(ctx, issue.id, a.id);
    expect(await target("workout", today)).toBe(30);
    expect(await target("workout", "2026-11-24")).toBe(30);
  });

  it("a paused habit isn't due on those days; resolving the issue ends the pause", async () => {
    const { store, ctx, habit, draft } = await setup();
    const bath = await habit("bath");
    const issue = await createHealthIssue(ctx, draft());
    await applyChange(ctx, issue.id, bath.id, { mode: "pause" }, 3);

    const paused = (await store.habits.get(bath.id))!;
    expect(paused.pauses).toEqual([{ from: today, to: "2026-11-23" }]);
    const day = summarizeDay({
      date: "2026-11-22",
      dayStartHour: 4,
      habits: [{ habit: paused, targets: [], entry: null }],
    });
    expect(day).toMatchObject({ countedCount: 0, averageProgress: null });

    await setHealthStatus({ ...ctx, today: "2026-11-22" }, issue.id, "resolved");
    expect((await store.habits.get(bath.id))!.pauses).toEqual([{ from: today, to: today }]);
  });
});
