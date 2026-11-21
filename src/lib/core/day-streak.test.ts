import { describe, expect, it } from "vitest";
import { dayStreak, quickAmounts } from "./day-streak";

const base = {
  from: "2026-11-15",
  today: "2026-11-20",
  threshold: 80,
  restDates: new Set<string>(),
};
const days = (values: (number | null)[]) =>
  new Map(values.map((v, i) => [`2026-11-${15 + i}`, v] as [string, number | null]));

describe("overall day streak (days at 80% or more)", () => {
  it("counts consecutive good days; today not reaching 80% yet doesn't break it", () => {
    // 15..19 good, 20 (today) only 30% so far
    expect(dayStreak({ ...base, averages: days([90, 100, 85, 80, 95, 30]) })).toEqual({
      current: 5,
      best: 5,
    });
  });

  it("a day under 80% breaks it", () => {
    expect(dayStreak({ ...base, averages: days([90, 100, 50, 80, 95, 100]) })).toEqual({
      current: 3,
      best: 3,
    });
  });

  it("rest days and days with nothing due are skipped", () => {
    const r = dayStreak({
      ...base,
      averages: days([90, 10, null, 80, 95, 100]),
      restDates: new Set(["2026-11-16"]), // the 10% day was a sick day
    });
    expect(r).toEqual({ current: 5 - 1, best: 4 });
  });
});

describe("quick-add amounts", () => {
  it("picks round steps from the target", () => {
    expect(quickAmounts("numeric", 5000)).toEqual([500, 1000]);
    expect(quickAmounts("numeric", 3)).toEqual([0.25, 0.5]); // 3 L of water
    expect(quickAmounts("numeric", 7)).toEqual([0.5, 1]); // 7 hours of sleep
    expect(quickAmounts("duration", 30)).toEqual([5, 15]);
    expect(quickAmounts("duration", 60)).toEqual([15, 30]);
    expect(quickAmounts("numeric", null)).toEqual([1, 2]);
  });
});
