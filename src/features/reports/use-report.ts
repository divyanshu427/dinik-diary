"use client";

import { useMemo } from "react";
import { isUnlocked } from "@/data/habit-ops";
import type { HabitTarget } from "@/data/schema";
import { useActivities } from "@/hooks/use-activities";
import {
  useCategories,
  useDayStatuses,
  useHabitLogs,
  useHabits,
  useHabitTargets,
  usePhases,
  useSettings,
} from "@/hooks/use-data";
import { useMetrics } from "@/hooks/use-metrics";
import { useNow, useToday } from "@/hooks/use-today";
import {
  buildReport,
  compareReports,
  minutesIntoDay,
  pausedDates,
  periodInsights,
  periodRange,
  previousPeriod,
  targetOn,
  zonedParts,
  type IsoDate,
  type PeriodKind,
  type ReportConfig,
  type ReportData,
} from "@/lib/core";

/**
 * Everything the reports need, worked out by the report engine for one period:
 * the report, the one before it, the comparison and the insights.
 */
export function useReport(kind: PeriodKind, anchor: IsoDate | null) {
  const settings = useSettings();
  const phases = usePhases();
  const habits = useHabits();
  const targets = useHabitTargets();
  const logs = useHabitLogs();
  const dayStatuses = useDayStatuses();
  const activities = useActivities();
  const metrics = useMetrics();
  const categories = useCategories();
  const today = useToday();
  const now = useNow();

  const queries = [
    settings,
    phases,
    habits,
    targets,
    logs,
    dayStatuses,
    activities,
    metrics,
    categories,
  ];
  const isError = queries.some((q) => q.isError);
  const ready = queries.every((q) => q.data) && today && now;

  const result = useMemo(() => {
    if (!ready) return null;
    const s = settings.data!;
    const targetsByHabit = new Map<string, HabitTarget[]>();
    for (const t of targets.data!)
      targetsByHabit.set(t.habitId, [...(targetsByHabit.get(t.habitId) ?? []), t]);

    const unlocked = new Set(phases.data!.filter(isUnlocked).map((p) => p.id));
    const scored = habits.data!.filter((h) => !h.archived && unlocked.has(h.phaseId));
    const sleepHabit = habits.data!.find(
      (h) =>
        !h.archived &&
        h.categoryId &&
        ["bed_time", "wake_time", "sleep_hours"].includes(h.metricKey ?? ""),
    );
    const bedHabit = habits.data!.find((h) => !h.archived && h.metricKey === "bed_time");

    const data: ReportData = {
      habits: scored,
      targetsByHabit,
      logs: logs.data!,
      dayStatuses: dayStatuses.data!,
      activities: activities.data!,
      metrics: metrics.data!,
      sleepCategoryId: sleepHabit?.categoryId ?? null,
      pausedDates: pausedDates(phases.data!, today!),
    };
    const clock = zonedParts(now!, s.timezone);
    const config: ReportConfig = {
      timeZone: s.timezone,
      dayStartHour: s.dayStartHour,
      weekStart: s.weekStart,
      threshold: s.unlockThreshold,
      today: today!,
      nowMinute: minutesIntoDay(
        `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
        s.dayStartHour,
      ),
    };

    // "All time" starts at the first thing logged.
    let earliest: IsoDate = today!;
    for (const rows of [logs.data!, activities.data!, metrics.data!])
      for (const r of rows) if (r.date < earliest) earliest = r.date;

    const range = periodRange(kind, anchor ?? today!, s.weekStart, earliest);
    const report = buildReport(data, range, config);
    const prevRange = previousPeriod(kind, range);
    const previous = prevRange ? buildReport(data, prevRange, config) : null;
    const comparison = previous ? compareReports(report, previous) : null;
    const bedTimes = new Map(
      metrics
        .data!.filter((m) => m.key === "bed_time" && m.valueTime)
        .map((m) => [m.date, m.valueTime!]),
    );
    const bedBy = bedHabit
      ? (targetOn(targetsByHabit.get(bedHabit.id) ?? [], today!)?.targetTime ?? null)
      : null;
    const insights = periodInsights({
      report,
      previous,
      comparison,
      dayStartHour: s.dayStartHour,
      bedBy,
      bedTimes,
    });

    return {
      report,
      previous,
      comparison,
      insights,
      settings: s,
      today: today!,
      habitById: new Map(habits.data!.map((h) => [h.id, h])),
      categories: categories.data!,
      categoryById: new Map(categories.data!.map((c) => [c.id, c])),
      sleepCategoryId: data.sleepCategoryId,
      metrics: metrics.data!.filter((m) => m.date >= range.start && m.date <= range.end),
      nowMinute: config.nowMinute ?? null,
      /** The target of the (non-archived) habit that reads a metric, e.g. 5,000 steps. */
      metricTarget: (key: string) => {
        const habit = habits.data!.find((h) => !h.archived && h.metricKey === key);
        return habit
          ? (targetOn(targetsByHabit.get(habit.id) ?? [], today!)?.targetValue ?? null)
          : null;
      },
    };
    // `ready` covers every query's data.
  }, [
    ready,
    kind,
    anchor,
    settings.data,
    phases.data,
    habits.data,
    targets.data,
    logs.data,
    dayStatuses.data,
    activities.data,
    metrics.data,
    categories.data,
    today,
    now,
  ]);

  return { result, isError };
}
