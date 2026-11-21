import { describe, expect, it } from "vitest";
import type { Activity, Habit, HabitLog, HabitTarget, Metric } from "@/data/schema";
import { addDays, eachDay } from "./day";
import { habitInsights, skipTogether } from "./insights";
import type { HabitDay } from "./habit-stats";
import {
  buildReport,
  change,
  compareReports,
  dayMinutes,
  periodRange,
  previousPeriod,
  SLEEP_KEY,
  toSlices,
  UNLOGGED_KEY,
  type PeriodReport,
  type ReportConfig,
  type ReportData,
} from "./reports";

const TS = "2026-11-01T06:30:00.000Z";
let n = 0;
const id = () => `x${++n}`;

const habit = (key: string, over: Partial<Habit> = {}): Habit => ({
  id: key,
  createdAt: TS,
  updatedAt: TS,
  key,
  name: key,
  description: "",
  type: "boolean",
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
const target = (habitId: string): HabitTarget => ({
  id: id(),
  createdAt: TS,
  updatedAt: TS,
  habitId,
  targetValue: null,
  targetTime: null,
  graceMinutes: 0,
  validFrom: "2000-01-01",
  validTo: null,
});
const done = (habitId: string, date: string): HabitLog => ({
  id: id(),
  createdAt: TS,
  updatedAt: TS,
  habitId,
  date,
  value: 1,
  time: null,
  done: true,
  progress: 100,
  note: "",
  source: "web",
  rawMessageId: null,
});
const act = (over: Partial<Activity>): Activity => ({
  id: id(),
  createdAt: TS,
  updatedAt: TS,
  title: "x",
  categoryId: "work",
  subcategory: null,
  date: "2026-11-10",
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
  source: "web",
  rawMessageId: null,
  aiConfidence: null,
  confirmed: true,
  ...over,
});
const metric = (date: string, key: Metric["key"], value: number | string): Metric => ({
  id: id(),
  createdAt: TS,
  updatedAt: TS,
  date,
  key,
  valueNum: typeof value === "number" ? value : null,
  valueTime: typeof value === "string" ? value : null,
});

const config: ReportConfig = {
  timeZone: "Asia/Kolkata",
  dayStartHour: 4,
  weekStart: "monday",
  threshold: 80,
  today: "2026-11-20",
};

function data(over: Partial<ReportData> = {}): ReportData {
  const habits = over.habits ?? [];
  return {
    habits,
    targetsByHabit: new Map(habits.map((h) => [h.id, [target(h.id)]])),
    logs: [],
    dayStatuses: [],
    activities: [],
    metrics: [],
    sleepCategoryId: null,
    ...over,
  };
}

const sum = (xs: { percent: number }[]) =>
  Math.round(xs.reduce((a, s) => a + s.percent, 0) * 10) / 10;

describe("periods", () => {
  it("weeks and months, and the one before", () => {
    const week = periodRange("week", "2026-11-20", "monday");
    expect(week).toEqual({ start: "2026-11-16", end: "2026-11-22" });
    expect(previousPeriod("week", week)).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    const month = periodRange("month", "2026-11-20", "monday");
    expect(month).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(previousPeriod("month", month)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(periodRange("all", "2026-11-20", "monday", "2026-09-03")).toEqual({
      start: "2026-09-03",
      end: "2026-11-20",
    });
    expect(previousPeriod("all", month)).toBeNull();
  });
});

describe("time allocation", () => {
  it("sleep, overlaps and untimed entries on one day", () => {
    const minutes = dayMinutes({
      date: "2026-11-10",
      dayStartHour: 4,
      activities: [
        act({ categoryId: "work", startTime: "09:00", endTime: "17:00" }),
        act({ categoryId: "meals", startTime: "13:00", endTime: "14:00" }),
        act({ categoryId: "fun", durationMinutes: 60 }),
      ],
      bedTimes: new Map([
        ["2026-11-09", "23:30"],
        ["2026-11-10", "23:00"],
      ]),
      wakeTimes: new Map([
        ["2026-11-10", "07:30"],
        ["2026-11-11", "07:00"],
      ]),
    });
    // Sleep: 04:00–07:30 (210) + 23:00–04:00 (300). Work loses the lunch hour.
    expect(Object.fromEntries(minutes)).toEqual({
      [SLEEP_KEY]: 510,
      work: 420,
      meals: 60,
      fun: 60,
    });
  });

  it("adds up to 100% of the period in both views, with an honest Unlogged share", () => {
    const report = buildReport(
      data({
        activities: [
          act({ date: "2026-11-10", categoryId: "work", startTime: "09:00", endTime: "17:00" }),
          act({ date: "2026-11-11", categoryId: "travel", startTime: "16:00", endTime: "19:30" }),
          act({ date: "2026-11-11", categoryId: "fun", durationMinutes: 45 }),
        ],
        metrics: [
          metric("2026-11-10", "bed_time", "23:30"),
          metric("2026-11-11", "wake_time", "07:30"),
        ],
        sleepCategoryId: "sleep",
      }),
      { start: "2026-11-10", end: "2026-11-12" },
      config,
    );
    const { time } = report;
    expect(time.totalMinutes).toBe(3 * 1440);
    expect(time.sleepMinutes).toBe(480);
    expect(sum(time.day)).toBe(100);
    expect(sum(time.waking)).toBe(100);
    expect(time.day.find((s) => s.key === "sleep")?.minutes).toBe(480);
    expect(time.waking.some((s) => s.key === "sleep" || s.key === SLEEP_KEY)).toBe(false);
    expect(time.day.at(-1)?.key).toBe(UNLOGGED_KEY);
    expect(time.day.find((s) => s.key === UNLOGGED_KEY)?.minutes).toBe(
      3 * 1440 - 480 - 480 - 210 - 45,
    );
  });

  it("rounds shares so they always total exactly 100", () => {
    const slices = toSlices(
      new Map([
        ["a", 1],
        ["b", 1],
        ["c", 1],
      ]),
      3,
    );
    expect(slices.map((s) => s.percent)).toEqual([33.4, 33.3, 33.3]);
    expect(
      sum(
        toSlices(
          new Map([
            ["a", 137],
            ["b", 911],
          ]),
          1440,
        ),
      ),
    ).toBe(100);
  });

  it("today only counts up to now", () => {
    const report = buildReport(
      data(),
      { start: "2026-11-20", end: "2026-11-20" },
      { ...config, nowMinute: 300 },
    );
    expect(report.time.totalMinutes).toBe(300);
  });
});

describe("habit numbers", () => {
  const a = habit("a");
  const b = habit("b");

  it("averages finished, non-rest days; counts fully done days and best/worst", () => {
    const report = buildReport(
      data({
        habits: [a, b],
        logs: [
          done("a", "2026-11-16"),
          done("b", "2026-11-16"),
          done("a", "2026-11-17"),
          done("a", "2026-11-19"),
          // Today: half done, so it's left out of the average.
          done("a", "2026-11-20"),
        ],
        dayStatuses: [{ date: "2026-11-18", type: "sick", note: "", updatedAt: TS }],
      }),
      { start: "2026-11-16", end: "2026-11-22" },
      config,
    );
    expect(report.days.map((d) => d.date)).toEqual(eachDay("2026-11-16", "2026-11-20"));
    expect(report.scoredDays).toBe(3); // 16, 17, 19 (18 was a sick day, 20 is today)
    expect(report.averageProgress).toBe(round((100 + 50 + 50) / 3));
    expect(report.daysFullyDone).toBe(1);
    expect(report.restDays).toBe(1);
    expect(report.bestDay).toEqual({ date: "2026-11-16", average: 100 });
    expect(report.worstDay).toEqual({ date: "2026-11-19", average: 50 });
    expect(report.habits.find((h) => h.habitId === "a")?.doneDays).toBe(4);
  });

  it("compares two periods", () => {
    expect(change(72, 60)).toEqual({ current: 72, previous: 60, change: 12, changePct: 20 });
    expect(change(5, 0).changePct).toBeNull();
    expect(change(null, 3).change).toBeNull();

    const week = (logs: HabitLog[], range: { start: string; end: string }) =>
      buildReport(data({ habits: [a], logs }), range, config);
    const now = week(
      ["2026-11-16", "2026-11-17", "2026-11-18"].map((d) => done("a", d)),
      { start: "2026-11-16", end: "2026-11-19" },
    );
    const before = week([done("a", "2026-11-09")], { start: "2026-11-09", end: "2026-11-12" });
    const c = compareReports(now, before);
    expect(c.averageProgress).toMatchObject({
      current: 75,
      previous: 25,
      change: 50,
      changePct: 200,
    });
  });
});

const round = (x: number) => Math.round(x * 10) / 10;

// ---------- insights ----------

function habitDays(dates: string[], isDone: (date: string, i: number) => boolean): HabitDay[] {
  return dates.map((date, i) => {
    const ok = isDone(date, i);
    return { date, state: ok ? "done" : "missed", progress: ok ? 100 : 0, counted: true };
  });
}

function fakeReport(habits: { id: string; days: HabitDay[] }[]): PeriodReport {
  return {
    habits: habits.map((h) => ({
      habitId: h.id,
      days: h.days,
      percent: null,
      doneDays: 0,
      countedDays: h.days.length,
      streak: { current: 0, best: 0, unit: "days" },
    })),
  } as unknown as PeriodReport;
}

/** Same pseudo-random sequence every run. */
function noise(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

describe("insights only fire on real patterns", () => {
  const dates = eachDay("2026-10-01", "2026-10-30");

  it("skipped together: fires when B goes with A", () => {
    const breakfast = habitDays(dates, (_d, i) => i % 3 !== 0); // skipped every 3rd day
    const skincare = habitDays(dates, (_d, i) => i % 3 !== 0 || i === 3); // skipped with it (once kept)
    const [insight] = skipTogether(
      fakeReport([
        { id: "breakfast", days: breakfast },
        { id: "skincare", days: skincare },
      ]),
    );
    expect(insight).toMatchObject({
      kind: "skip-together",
      habitId: "skincare",
      withHabitId: "breakfast",
      both: 9,
      of: 10,
    });
  });

  it("skipped together: silent for unrelated habits", () => {
    const r1 = noise(7);
    const r2 = noise(99);
    const report = fakeReport([
      { id: "a", days: habitDays(dates, () => r1() < 0.6) },
      { id: "b", days: habitDays(dates, () => r2() < 0.6) },
    ]);
    expect(skipTogether(report)).toEqual([]);
  });

  it("skipped together: silent when both are just weaker on weekdays", () => {
    const eight = eachDay("2026-09-07", "2026-11-01");
    const weekday = (d: string) => (new Date(d).getUTCDay() + 6) % 7;
    const report = fakeReport([
      // Floss: missed Tuesday to Thursday. Steps: missed on every weekday.
      { id: "floss", days: habitDays(eight, (d) => ![1, 2, 3].includes(weekday(d))) },
      { id: "steps", days: habitDays(eight, (d) => weekday(d) >= 5) },
    ]);
    expect(skipTogether(report)).toEqual([]);
  });

  it("per habit: weekends vs weekdays, and a weak stretch", () => {
    const eight = eachDay("2026-09-07", "2026-11-01"); // 8 full weeks from a Monday
    const steps = habitDays(eight, (d) =>
      [5, 6].includes(new Date(d).getUTCDay() === 0 ? 6 : new Date(d).getUTCDay() - 1),
    );
    expect(habitInsights(steps)).toContainEqual({
      kind: "weekday-pattern",
      best: "weekends",
      worst: null,
    });

    const floss = habitDays(eight, (d) => ![2, 3, 4].includes(new Date(d).getUTCDay())); // miss Tue–Thu
    // "You hit this most on weekends and miss it Tuesday to Thursday."
    expect(habitInsights(floss)).toContainEqual({
      kind: "weekday-pattern",
      best: "weekends",
      worst: [1, 3],
    });

    const r = noise(3);
    const random = habitDays(eight, () => r() < 0.7);
    expect(habitInsights(random)).toEqual([]);
  });

  it("per habit: a clear change over the last two weeks", () => {
    const days = habitDays(eachDay("2026-10-01", "2026-10-28"), (_d, i) =>
      i < 14 ? i % 3 === 0 : i % 7 !== 0,
    );
    expect(habitInsights(days)).toContainEqual({ kind: "trend", recent: 86, before: 36 });
  });
});

describe("report on a quiet period", () => {
  it("has nothing to say rather than guessing", () => {
    const report = buildReport(
      data({ habits: [habit("a")] }),
      { start: addDays("2026-11-20", -6), end: "2026-11-20" },
      config,
    );
    expect(report.bestDay).toBeNull();
    expect(report.categories).toEqual([]);
  });
});
