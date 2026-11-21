import { describe, expect, it } from "vitest";
import type { HabitSchedule } from "@/data/schema";
import { computeStreak, weeklyCount } from "./streaks";

const daily: HabitSchedule = { kind: "daily" };
const set = (...dates: string[]) => new Set(dates);
const base = {
  schedule: daily,
  restDates: set(),
  startDate: "2026-11-15",
  today: "2026-11-20",
  weekStart: "monday" as const,
};

describe("daily streaks", () => {
  it("continues across a rest day", () => {
    const s = computeStreak({
      ...base,
      doneDates: set("2026-11-15", "2026-11-16", "2026-11-18", "2026-11-19", "2026-11-20"),
      restDates: set("2026-11-17"),
    });
    expect(s).toEqual({ current: 5, best: 5, unit: "days" }); // 5 done days, rest day skipped
  });

  it("breaks on a normal missed day", () => {
    const s = computeStreak({
      ...base,
      doneDates: set("2026-11-15", "2026-11-16", "2026-11-18", "2026-11-19", "2026-11-20"),
    });
    expect(s).toEqual({ current: 3, best: 3, unit: "days" });
  });

  it("today not done yet doesn't break the streak", () => {
    const s = computeStreak({
      ...base,
      doneDates: set("2026-11-17", "2026-11-18", "2026-11-19"),
    });
    expect(s.current).toBe(3);
  });

  it("remembers the best run after a break", () => {
    const s = computeStreak({
      ...base,
      startDate: "2026-11-01",
      doneDates: set(
        "2026-11-01",
        "2026-11-02",
        "2026-11-03",
        "2026-11-04",
        "2026-11-19",
        "2026-11-20",
      ),
    });
    expect(s).toEqual({ current: 2, best: 4, unit: "days" });
  });

  it("is zero before the habit started", () => {
    expect(computeStreak({ ...base, startDate: "2026-12-01", doneDates: set() }).current).toBe(0);
  });
});

describe("scheduled habits", () => {
  it("Monday-only habit: the days in between don't break it", () => {
    const s = computeStreak({
      ...base,
      schedule: { kind: "weekdays", days: [0] },
      startDate: "2026-11-01",
      doneDates: set("2026-11-02", "2026-11-09", "2026-11-16"),
    });
    expect(s).toEqual({ current: 3, best: 3, unit: "days" });
  });

  it("every-10-days habit counts only its due days", () => {
    const s = computeStreak({
      ...base,
      schedule: { kind: "everyNDays", every: 10, anchor: "2026-11-01" },
      startDate: "2026-11-01",
      doneDates: set("2026-11-01", "2026-11-11"),
    });
    expect(s.current).toBe(2);
  });
});

describe("hair wash 3 times a week (streak in weeks)", () => {
  const hair = {
    ...base,
    schedule: { kind: "timesPerWeek", times: 3 } as const,
    startDate: "2026-11-02",
  };

  it("counts weeks that met the quota; the current week is still in progress", () => {
    const s = computeStreak({
      ...hair,
      doneDates: set(
        "2026-11-02",
        "2026-11-04",
        "2026-11-06", // week 1: 3 ✓
        "2026-11-10",
        "2026-11-12",
        "2026-11-14", // week 2: 3 ✓
        "2026-11-17", //                              this week: 1 so far
      ),
    });
    expect(s).toEqual({ current: 2, best: 2, unit: "weeks" });
  });

  it("a week with only 2 washes breaks the streak", () => {
    const s = computeStreak({
      ...hair,
      doneDates: set("2026-11-02", "2026-11-04", "2026-11-06", "2026-11-10", "2026-11-12"),
    });
    expect(s).toEqual({ current: 0, best: 1, unit: "weeks" });
  });

  it("a mostly-rest week only needs as many washes as there were normal days", () => {
    const s = computeStreak({
      ...hair,
      startDate: "2026-11-09",
      today: "2026-11-16",
      restDates: set(
        "2026-11-09",
        "2026-11-10",
        "2026-11-11",
        "2026-11-12",
        "2026-11-13",
        "2026-11-14",
      ),
      doneDates: set("2026-11-15"),
    });
    expect(s.current).toBe(1);
  });

  it("counts washes in the current week", () => {
    expect(weeklyCount(set("2026-11-15", "2026-11-17", "2026-11-19"), "2026-11-20", "monday")).toBe(
      2,
    );
  });
});
