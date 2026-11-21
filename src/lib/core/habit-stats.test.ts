import { describe, expect, it } from "vitest";
import type { HabitSchedule, HabitTarget } from "@/data/schema";
import {
  habitHistory,
  habitStartDate,
  habitStats,
  NOT_STARTED,
  type HabitHistoryInput,
} from "./habit-stats";

const target = (value: number | null): HabitTarget => ({
  id: "t",
  habitId: "h",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  targetValue: value,
  targetTime: null,
  graceMinutes: 0,
  validFrom: "2000-01-01",
  validTo: null,
});

const yes = { value: 1, time: null };
const amount = (n: number) => ({ value: n, time: null });

function input(
  over: Partial<HabitHistoryInput> & { schedule?: HabitSchedule } = {},
): HabitHistoryInput {
  const { schedule = { kind: "daily" }, ...rest } = over;
  return {
    habit: { type: "boolean", direction: "higher_better", schedule },
    targets: [target(null)],
    logs: new Map(),
    restDates: new Set(),
    startDate: "2026-11-01",
    today: "2026-11-20",
    dayStartHour: 4,
    ...rest,
  };
}

const states = (i: HabitHistoryInput, from: string, to: string) =>
  habitHistory(i, from, to).map((d) => d.state);

describe("habit day states", () => {
  it("done, missed, rest, today and future", () => {
    const i = input({
      logs: new Map([["2026-11-17", yes]]),
      restDates: new Set(["2026-11-18"]),
    });
    expect(states(i, "2026-11-16", "2026-11-21")).toEqual([
      "missed", // 16th: nothing logged
      "done", // 17th
      "rest", // 18th: rest day
      "missed", // 19th
      "today", // 20th: not over yet
      "future", // 21st
    ]);
  });

  it("partial progress on a number habit", () => {
    const i = input({
      habit: { type: "numeric", direction: "higher_better", schedule: { kind: "daily" } },
      targets: [target(5000)],
      logs: new Map([["2026-11-19", amount(3420)]]),
    });
    const [day] = habitHistory(i, "2026-11-19", "2026-11-19");
    expect(day).toMatchObject({ state: "partial", progress: 68.4, counted: true });
  });

  it("days before the habit started are empty, unless back-filled", () => {
    const i = input({ startDate: "2026-11-19", logs: new Map([["2026-11-17", yes]]) });
    expect(states(i, "2026-11-16", "2026-11-18")).toEqual(["before-start", "done", "before-start"]);
  });

  it("days a scheduled habit isn't due are 'not due', never 'missed'", () => {
    const sundays = input({ schedule: { kind: "weekdays", days: [6] } });
    expect(states(sundays, "2026-11-14", "2026-11-16")).toEqual(["not-due", "missed", "not-due"]);
  });
});

describe("habit stats", () => {
  it("success rate counts due days that are over (today only once logged)", () => {
    const logs = new Map([
      ["2026-11-17", yes],
      ["2026-11-18", yes],
      ["2026-11-19", yes],
    ]);
    const s = habitStats({
      ...input({ logs, startDate: "2026-11-17" }),
      windowDays: 14,
      weekStart: "monday",
    });
    // 17, 18, 19 done; 20 (today) not done yet → not counted
    expect(s.percent).toBe(100);
    expect(s.doneDays).toBe(3);
    expect(s.streak).toMatchObject({ current: 3, best: 3 });
    expect(s.days).toHaveLength(14);
    expect(s.days.at(-1)).toMatchObject({ date: "2026-11-20", state: "today" });
  });

  it("averages partial progress", () => {
    const i = input({
      habit: { type: "count", direction: "higher_better", schedule: { kind: "daily" } },
      targets: [target(8)],
      logs: new Map([
        ["2026-11-18", amount(8)],
        ["2026-11-19", amount(4)],
      ]),
      startDate: "2026-11-18",
    });
    expect(habitStats({ ...i, windowDays: 14, weekStart: "monday" }).percent).toBe(75);
  });

  it("has no rate before any day counts", () => {
    const s = habitStats({
      ...input({ startDate: "2026-11-20" }),
      windowDays: 14,
      weekStart: "monday",
    });
    expect(s.percent).toBeNull();
    expect(s.days.filter((d) => d.state === "before-start")).toHaveLength(13);
  });

  it("'3 times a week' is measured against the weekly quota", () => {
    // 14 days available, quota 3/week → 6 expected; 3 done → 50%
    const logs = new Map([
      ["2026-11-08", yes],
      ["2026-11-12", yes],
      ["2026-11-16", yes],
    ]);
    const s = habitStats({
      ...input({ schedule: { kind: "timesPerWeek", times: 3 }, logs }),
      windowDays: 14,
      weekStart: "monday",
    });
    expect(s.percent).toBe(50);
    expect(s.days.filter((d) => d.state === "missed")).toHaveLength(0);
  });
});

describe("start dates in stats", () => {
  const config = { timeZone: "Asia/Kolkata", dayStartHour: 4 };
  const created = { createdAt: "2026-11-01T06:00:00.000Z" };

  it("a chosen start date is where the history begins; earlier days are never missed", () => {
    expect(habitStartDate({ ...created, startsOn: "2026-11-18" }, [], config)).toBe("2026-11-18");
    const i = input({
      startDate: "2026-11-18",
      habit: {
        type: "boolean",
        direction: "higher_better",
        schedule: { kind: "daily" },
        startsOn: "2026-11-18",
      },
    });
    expect(states(i, "2026-11-16", "2026-11-19")).toEqual([
      "before-start",
      "before-start",
      "missed",
      "missed",
    ]);
  });

  it("a habit that hasn't started has no history and no %", () => {
    const start = habitStartDate({ ...created, startsOn: null }, [], config);
    expect(start).toBe(NOT_STARTED);
    const stats = habitStats({
      ...input({
        startDate: start,
        habit: {
          type: "boolean",
          direction: "higher_better",
          schedule: { kind: "daily" },
          startsOn: null,
        },
      }),
      windowDays: 14,
      weekStart: "monday",
    });
    expect(stats.percent).toBeNull();
    expect(stats.days.every((d) => d.state === "before-start")).toBe(true);
  });

  it("without a start date, it counts from when the habit was made (as before)", () => {
    expect(habitStartDate(created, ["2026-10-30"], config)).toBe("2026-10-30");
  });
});
