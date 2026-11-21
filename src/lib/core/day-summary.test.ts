import { describe, expect, it } from "vitest";
import type { HabitTarget } from "@/data/schema";
import { summarizeDay, type HabitDayInput } from "./day-summary";

const target = (
  habitId: string,
  value: number | null,
  time: string | null = null,
): HabitTarget => ({
  id: `t-${habitId}`,
  habitId,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  targetValue: value,
  targetTime: time,
  graceMinutes: 15,
  validFrom: "2000-01-01",
  validTo: null,
});

const habit = (
  id: string,
  type: HabitDayInput["habit"]["type"],
  schedule: HabitDayInput["habit"]["schedule"] = { kind: "daily" },
) => ({ id, type, direction: "higher_better" as const, schedule });

const DATE = "2026-11-20";

describe("day summary", () => {
  const brush: HabitDayInput = {
    habit: habit("brush", "boolean"),
    targets: [target("brush", null)],
    entry: { value: 1, time: null },
  };
  const water: HabitDayInput = {
    habit: habit("water", "count"),
    targets: [target("water", 8)],
    entry: { value: 3, time: null },
  };
  const hairNotDone: HabitDayInput = {
    habit: habit("hair", "boolean", { kind: "timesPerWeek", times: 3 }),
    targets: [target("hair", null)],
    entry: null,
  };

  it("averages progress and counts fully done habits", () => {
    const s = summarizeDay({ date: DATE, habits: [brush, water], dayStartHour: 4 });
    expect(s.countedCount).toBe(2);
    expect(s.doneCount).toBe(1);
    expect(s.averageProgress).toBe(68.8); // (100 + 37.5) / 2
  });

  it("hair wash (3x a week) not done today doesn't lower the day's score", () => {
    const s = summarizeDay({ date: DATE, habits: [brush, hairNotDone], dayStartHour: 4 });
    expect(s.countedCount).toBe(1);
    expect(s.averageProgress).toBe(100);
  });

  it("hair wash done today counts as done", () => {
    const hairDone = { ...hairNotDone, entry: { value: 1, time: null } };
    const s = summarizeDay({ date: DATE, habits: [brush, hairDone], dayStartHour: 4 });
    expect(s.countedCount).toBe(2);
    expect(s.doneCount).toBe(2);
  });

  it("a habit not due today (Sunday-only on a Friday) is left out", () => {
    const sunday: HabitDayInput = {
      habit: habit("weigh", "boolean", { kind: "weekdays", days: [6] }),
      targets: [target("weigh", null)],
      entry: null,
    };
    const s = summarizeDay({ date: DATE, habits: [brush, sunday], dayStartHour: 4 });
    expect(s.items.find((i) => i.habitId === "weigh")).toMatchObject({
      role: "not-due",
      counted: false,
    });
    expect(s.averageProgress).toBe(100);
  });

  it("has no average when nothing counts that day", () => {
    expect(
      summarizeDay({ date: DATE, habits: [hairNotDone], dayStartHour: 4 }).averageProgress,
    ).toBeNull();
  });

  it("marks rest days and whether anything was logged", () => {
    const lateWake: HabitDayInput = {
      habit: habit("wake", "time"),
      targets: [target("wake", null, "07:30")],
      entry: { value: null, time: "09:00" },
    };
    const s = summarizeDay({ date: DATE, habits: [lateWake], dayType: "sick", dayStartHour: 4 });
    expect(s.isRestDay).toBe(true);
    expect(s.averageProgress).toBe(0);
    expect(s.hasAnyLog).toBe(true); // logged, even though it scored 0
  });
});
