import { describe, expect, it } from "vitest";
import {
  addDays,
  buildReport,
  compareReports,
  habitHistory,
  habitInsights,
  habitStartDate,
  periodInsights,
  periodRange,
  previousPeriod,
  UNLOGGED_KEY,
  type ReportConfig,
  type ReportData,
} from "@/lib/core";
import { backupFileSchema } from "./backup";
import { buildDemoData, DEMO_DAYS } from "./demo";
import type { HabitTarget } from "./schema";
import { makeTestStore } from "./test-utils";

const today = "2026-11-20";
const demo = buildDemoData({ today });
const d = demo.data;

const unlocked = new Set(d.phases.filter((p) => p.status !== "locked").map((p) => p.id));
const habits = d.habits.filter((h) => unlocked.has(h.phaseId));
const targetsByHabit = new Map<string, HabitTarget[]>();
for (const t of d.habitTargets)
  targetsByHabit.set(t.habitId, [...(targetsByHabit.get(t.habitId) ?? []), t]);
const sleepCategoryId = d.habits.find((h) => h.key === "bedtime")!.categoryId;

const data: ReportData = {
  habits,
  targetsByHabit,
  logs: d.habitLogs,
  dayStatuses: d.dayStatus,
  activities: d.activities,
  metrics: d.metrics,
  sleepCategoryId,
};
const config: ReportConfig = {
  timeZone: d.settings.timezone,
  dayStartHour: 4,
  weekStart: "monday",
  threshold: 80,
  today,
  nowMinute: 6 * 60, // 10 AM
};

describe("demo data", () => {
  it("is valid, repeatable, and covers 60 days", () => {
    expect(backupFileSchema.safeParse(demo).success).toBe(true);
    expect(JSON.stringify(buildDemoData({ today }))).toBe(JSON.stringify(demo));
    const dates = new Set(d.metrics.map((m) => m.date));
    expect(dates.size).toBe(DEMO_DAYS);
    expect([...dates].sort()[0]).toBe(addDays(today, -(DEMO_DAYS - 1)));
    expect(d.activities.every((a) => a.date <= today)).toBe(true);
  });

  it("loads into a store as the whole data set", async () => {
    const { store } = makeTestStore();
    await store.importAll(demo);
    const counts = await store.counts();
    expect(counts.habitLogs).toBe(d.habitLogs.length);
    expect(counts.activities).toBeGreaterThan(200);
  });

  it("gives sensible report numbers", () => {
    const range = periodRange("all", today, "monday", addDays(today, -(DEMO_DAYS - 1)));
    const report = buildReport(data, range, config);

    expect(report.days).toHaveLength(DEMO_DAYS);
    expect(report.averageProgress).toBeGreaterThan(50);
    expect(report.averageProgress).toBeLessThan(95);
    expect(report.daysFullyDone).toBeLessThan(report.scoredDays);
    expect(report.restDays).toBe(2);
    expect(report.bestDay!.average).toBeGreaterThan(report.worstDay!.average);

    const pct = (xs: { percent: number }[]) =>
      Math.round(xs.reduce((a, s) => a + s.percent, 0) * 10) / 10;
    expect(pct(report.time.day)).toBe(100);
    expect(pct(report.time.waking)).toBe(100);
    const sleepShare = report.time.day.find((s) => s.key === sleepCategoryId)!.percent;
    expect(sleepShare).toBeGreaterThan(25); // about 7–8 h a night
    expect(sleepShare).toBeLessThan(40);
    const unlogged = report.time.day.find((s) => s.key === UNLOGGED_KEY)!.percent;
    expect(unlogged).toBeGreaterThan(5);
    expect(unlogged).toBeLessThan(60);

    expect(report.metrics.steps!.average).toBeGreaterThan(3000);
    expect(report.metrics.sleep_hours!.average).toBeGreaterThan(6);
    expect(report.metrics.sleep_hours!.average).toBeLessThan(9);
  });

  it("the built-in patterns show up as insights", () => {
    const range = periodRange("month", today, "monday");
    const report = buildReport(data, range, config);
    const prev = buildReport(data, previousPeriod("month", range)!, config);
    const bedTimes = new Map(
      d.metrics.filter((m) => m.key === "bed_time").map((m) => [m.date, m.valueTime!]),
    );
    const insights = periodInsights({
      report: buildReport(data, periodRange("all", today, "monday", addDays(today, -59)), config),
      previous: prev,
      comparison: compareReports(report, prev),
      dayStartHour: 4,
      bedBy: "23:30",
      bedTimes,
    });
    const kinds = insights.map((i) => i.kind);
    // Steps (weak on weekdays) and flossing (weak Tue–Thu) only share weekdays: not a real link.
    const keyOf = (id: string) => habits.find((h) => h.id === id)?.key;
    const monthInsights = periodInsights({
      report,
      previous: prev,
      comparison: compareReports(report, prev),
      dayStartHour: 4,
      bedBy: "23:30",
      bedTimes,
    });
    for (const i of [...insights, ...monthInsights]) {
      if (i.kind !== "skip-together") continue;
      expect([keyOf(i.habitId), keyOf(i.withHabitId)].sort()).not.toEqual(["floss", "steps"]);
    }
    expect(kinds).toContain("skip-together");
    expect(kinds).toContain("bedtime-effect");
    expect(insights).toContainEqual(
      expect.objectContaining({ kind: "metric-change", metric: "reels_minutes", tone: "negative" }),
    );

    // Per habit: steps at weekends, flossing missed Tuesday to Thursday.
    const historyOf = (key: string) => {
      const habit = habits.find((h) => h.key === key)!;
      const logs = new Map(
        d.habitLogs.filter((l) => l.habitId === habit.id).map((l) => [l.date, l]),
      );
      return habitHistory(
        {
          habit,
          targets: targetsByHabit.get(habit.id)!,
          logs,
          restDates: new Set(d.dayStatus.map((s) => s.date)),
          startDate: habitStartDate(habit, logs.keys(), config),
          today,
          dayStartHour: 4,
        },
        addDays(today, -55),
        today,
      );
    };
    expect(habitInsights(historyOf("steps"))).toContainEqual(
      expect.objectContaining({ kind: "weekday-pattern", best: "weekends" }),
    );
    expect(habitInsights(historyOf("floss"))).toContainEqual(
      expect.objectContaining({ kind: "weekday-pattern", worst: [1, 3] }),
    );
  });
});
