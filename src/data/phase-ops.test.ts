import { describe, expect, it } from "vitest";
import { targetOn } from "@/lib/core";
import type { OpsContext } from "./habit-ops";
import {
  enablePhase,
  lockPhase,
  pausePhase,
  repeatPhase,
  resumePhase,
  setTargetUpgrades,
} from "./phase-ops";
import { makeTestStore } from "./test-utils";

async function setup(today = "2026-11-20") {
  const { store } = makeTestStore();
  const ctx: OpsContext = { store, today, dayStartHour: 4 };
  const phases = (await store.phases.list()).sort((a, b) => a.number - b.number);
  const steps = (await store.habits.getByKey("steps"))!;
  const stepsTarget = async (date: string) =>
    targetOn(await store.habitTargets.listByHabit(steps.id), date)?.targetValue;
  return { store, ctx, phases, steps, stepsTarget };
}

describe("phase manager", () => {
  it("the starter Phase 2 raises daily steps to 8,000", async () => {
    const { phases, steps } = await setup();
    expect(phases[1].targetUpgrades).toEqual([
      { habitId: steps.id, targetValue: 8000, targetTime: null, graceMinutes: 0 },
    ]);
    expect(phases[0].history).toEqual([{ date: expect.any(String), kind: "started" }]);
  });

  it("enabling Phase 2 stacks it on Phase 1 and applies its target upgrade from today", async () => {
    const { store, ctx, phases, steps, stepsTarget } = await setup();
    // A check-in today is re-scored against the new target.
    await store.habitLogs.upsert(steps.id, "2026-11-20", {
      value: 6000,
      time: null,
      done: true,
      progress: 100,
    });

    await enablePhase(ctx, phases[1].id);

    const [p1, p2] = (await store.phases.list()).sort((a, b) => a.number - b.number);
    expect(p1.status).toBe("completed");
    expect(p1.history.at(-1)).toEqual({ date: "2026-11-20", kind: "completed" });
    expect(p2.status).toBe("active");
    expect(p2.history.at(-1)).toMatchObject({
      date: "2026-11-20",
      kind: "started",
      changes: [{ habitId: steps.id, from: { targetValue: 5000 }, to: { targetValue: 8000 } }],
    });
    expect(await stepsTarget("2026-11-19")).toBe(5000); // the past keeps its target
    expect(await stepsTarget("2026-11-20")).toBe(8000);
    expect(await store.habitLogs.get(steps.id, "2026-11-20")).toMatchObject({
      done: false,
      progress: 75,
    });
  });

  it("enabling early is remembered in the history", async () => {
    const { store, ctx, phases } = await setup();
    await enablePhase(ctx, phases[3].id, { early: true });
    const p4 = (await store.phases.get(phases[3].id))!;
    expect(p4.history.at(-1)).toMatchObject({ kind: "started", early: true });
    await expect(enablePhase(ctx, phases[3].id)).rejects.toThrow(/already on/);
  });

  it("locking a phase again restores the targets and reactivates the phase before it", async () => {
    const { store, ctx, phases, stepsTarget } = await setup();
    await enablePhase(ctx, phases[1].id);
    await lockPhase({ ...ctx, today: "2026-11-22" }, phases[1].id);

    const [p1, p2] = (await store.phases.list()).sort((a, b) => a.number - b.number);
    expect(p2.status).toBe("locked");
    expect(p1.status).toBe("active");
    expect(await stepsTarget("2026-11-21")).toBe(8000);
    expect(await stepsTarget("2026-11-22")).toBe(5000);
  });

  it("repeat, pause and resume are written to the history", async () => {
    const { store, ctx, phases } = await setup();
    const id = phases[0].id;
    await repeatPhase(ctx, id);
    await pausePhase({ ...ctx, today: "2026-11-21" }, id);
    expect((await store.phases.get(id))!.status).toBe("paused");
    await resumePhase({ ...ctx, today: "2026-11-25" }, id);
    const p = (await store.phases.get(id))!;
    expect(p.status).toBe("active");
    expect(p.history.slice(1).map((e) => [e.date, e.kind])).toEqual([
      ["2026-11-20", "repeated"],
      ["2026-11-21", "paused"],
      ["2026-11-25", "resumed"],
    ]);
  });

  it("target upgrades can be edited, one per habit", async () => {
    const { store, ctx, phases, steps } = await setup();
    const up = (targetValue: number) => ({
      habitId: steps.id,
      targetValue,
      targetTime: null,
      graceMinutes: 0,
    });
    await setTargetUpgrades(ctx, phases[2].id, [up(9000), up(10000)]);
    expect((await store.phases.get(phases[2].id))!.targetUpgrades).toEqual([up(10000)]);
  });
});
