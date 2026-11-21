import { describe, expect, it } from "vitest";
import type { Habit, HabitLog, HabitTarget, Phase, PhaseEvent } from "@/data/schema";
import { addDays, eachDay } from "./day";
import { pausedDates, phaseReadiness, type ReadinessInput } from "./readiness";

const TS = "2026-10-01T06:30:00.000Z";
const today = "2026-11-20";
const rules = { threshold: 80, windowDays: 14, minLoggedDays: 10 };
const config = { timeZone: "Asia/Kolkata", dayStartHour: 4 };

const phase = (number: number, over: Partial<Phase> = {}): Phase => ({
  id: `p${number}`,
  createdAt: TS,
  updatedAt: TS,
  number,
  name: `Phase ${number}`,
  description: "",
  status: number === 1 ? "active" : "locked",
  startedAt: number === 1 ? TS : null,
  endedAt: null,
  targetUpgrades: [],
  history: number === 1 ? [{ date: "2026-10-01", kind: "started" }] : [],
  ...over,
});

const habit = (key: string, over: Partial<Habit> = {}): Habit => ({
  id: key,
  createdAt: TS,
  updatedAt: TS,
  key,
  name: key,
  description: "",
  type: "count",
  unit: "",
  direction: "higher_better",
  schedule: { kind: "daily" },
  phaseId: "p1",
  categoryId: null,
  metricKey: null,
  partOfDay: "anytime",
  pauses: [],
  archived: false,
  sortOrder: 0,
  ...over,
});

const target = (habitId: string, targetValue: number | null = 10): HabitTarget => ({
  id: `t-${habitId}`,
  createdAt: TS,
  updatedAt: TS,
  habitId,
  targetValue,
  targetTime: null,
  graceMinutes: 0,
  validFrom: "2000-01-01",
  validTo: null,
});

/** A check-in worth `pct`% of a count habit with target 10. */
const log = (habitId: string, date: string, pct: number): HabitLog => ({
  id: `${habitId}-${date}`,
  createdAt: TS,
  updatedAt: TS,
  habitId,
  date,
  value: pct / 10,
  time: null,
  done: pct >= 100,
  progress: pct,
  note: "",
  source: "web",
  rawMessageId: null,
});

/** The 14 finished days before today. */
const window = eachDay(addDays(today, -14), addDays(today, -1));

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
  const habits = over.habits ?? [habit("a")];
  return {
    phases: [phase(1), phase(2)],
    habits,
    targetsByHabit: new Map(habits.map((h) => [h.id, [target(h.id)]])),
    logs: [],
    dayStatuses: [],
    activityDates: new Set(),
    today,
    config,
    rules,
    ...over,
  };
}

describe("phase readiness", () => {
  it("needs at least 10 logged days in the 14-day window", () => {
    const nine = phaseReadiness(input({ logs: window.slice(0, 9).map((d) => log("a", d, 100)) }));
    expect(nine).toMatchObject({ state: "too-few-logged", loggedDays: 9, average: 100 });

    const ten = phaseReadiness(input({ logs: window.slice(0, 10).map((d) => log("a", d, 100)) }));
    expect(ten).toMatchObject({ state: "ready", loggedDays: 10, judgedDays: 14 });
    expect(ten.next?.number).toBe(2);
  });

  it("79% isn't enough, 80% is", () => {
    const at = (pct: number) =>
      phaseReadiness(input({ logs: window.map((d) => log("a", d, pct)) }));
    expect(at(79)).toMatchObject({ state: "below-target", average: 79 });
    expect(at(80)).toMatchObject({ state: "ready", average: 80 });
  });

  it("counts days from the start of the phase: Day 9 of 14", () => {
    const started = addDays(today, -8);
    const r = phaseReadiness(
      input({ phases: [phase(1, { history: [{ date: started, kind: "started" }] }), phase(2)] }),
    );
    expect(r).toMatchObject({ state: "in-progress", dayNumber: 9, judgedDays: 8 });
    expect(r.days.at(-1)).toMatchObject({ date: today, today: true });
  });

  it("repeating the phase starts the window again", () => {
    const history: PhaseEvent[] = [
      { date: "2026-10-01", kind: "started" },
      { date: addDays(today, -2), kind: "repeated" },
    ];
    const r = phaseReadiness(input({ phases: [phase(1, { history }), phase(2)] }));
    expect(r).toMatchObject({ state: "in-progress", dayNumber: 3, cycleStart: addDays(today, -2) });
  });

  it("rest and paused days are left out of the window", () => {
    const history: PhaseEvent[] = [
      { date: "2026-10-01", kind: "started" },
      { date: "2026-11-10", kind: "paused" },
      { date: "2026-11-13", kind: "resumed" },
    ];
    expect([...pausedDates([phase(1, { history })], today)]).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
    const r = phaseReadiness(
      input({
        phases: [phase(1, { history }), phase(2)],
        dayStatuses: [{ date: "2026-11-15", type: "sick", note: "", updatedAt: TS }],
      }),
    );
    const dates = r.days.map((d) => d.date);
    expect(dates).not.toContain("2026-11-11");
    expect(dates).not.toContain("2026-11-15");
    expect(r.judgedDays).toBe(14);
    expect(dates[0]).toBe("2026-11-02"); // pushed back by the 4 skipped days

    const pausedNow = phaseReadiness(
      input({
        phases: [
          phase(1, { status: "paused", history: [...history, { date: today, kind: "paused" }] }),
        ],
      }),
    );
    expect(pausedNow.state).toBe("paused");
  });

  it("scheduled habits count only on the days they're due", () => {
    // "b" is due on Mondays only (and never done); "a" is always done.
    const b = habit("b", { schedule: { kind: "weekdays", days: [0] } });
    const r = phaseReadiness(
      input({ habits: [habit("a"), b], logs: window.map((d) => log("a", d, 100)) }),
    );
    // 2 Mondays at 50%, 12 other days at 100%.
    expect(r.average).toBe(Math.round(((2 * 50 + 12 * 100) / 14) * 10) / 10);
    expect(r.weakest).toEqual([]);
    expect(r.strongest[0]).toEqual({ habitId: "a", percent: 100 });
  });

  it("an activity alone makes a logged day", () => {
    const r = phaseReadiness(
      input({
        logs: window.slice(0, 9).map((d) => log("a", d, 100)),
        activityDates: new Set([window[12]]),
      }),
    );
    expect(r.loggedDays).toBe(10);
  });

  it("with nothing switched on there's no current phase", () => {
    const r = phaseReadiness(input({ phases: [phase(1, { status: "locked", history: [] })] }));
    expect(r).toMatchObject({ state: "no-phase", phase: null });
    expect(r.next?.number).toBe(1);
  });
});
