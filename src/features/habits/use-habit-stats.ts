"use client";

import { useMemo } from "react";
import type { DayStatus, Habit, HabitLog, HabitTarget, Settings } from "@/data/schema";
import { habitStartDate, habitStats, type HabitStats, type IsoDate } from "@/lib/core";

export interface HabitStatsInput {
  habits: readonly Habit[];
  targetsByHabit: Map<string, HabitTarget[]>;
  logs: readonly HabitLog[];
  dayStatuses: readonly DayStatus[];
  settings: Settings;
  today: IsoDate;
  windowDays: number;
  /** Days a phase was paused: treated like rest days. */
  pausedDates?: ReadonlySet<IsoDate>;
}

/** Stats for every habit over the last `windowDays` days (14 for the table, 30 for the heatmap). */
export function useHabitStats(input: HabitStatsInput | null): Map<string, HabitStats> {
  return useMemo(() => {
    const result = new Map<string, HabitStats>();
    if (!input) return result;
    const { habits, targetsByHabit, logs, dayStatuses, settings, today, windowDays } = input;

    const logsByHabit = new Map<string, Map<IsoDate, HabitLog>>();
    for (const log of logs) {
      if (!logsByHabit.has(log.habitId)) logsByHabit.set(log.habitId, new Map());
      logsByHabit.get(log.habitId)!.set(log.date, log);
    }
    const restDates = new Set([
      ...dayStatuses.filter((d) => d.type !== "normal").map((d) => d.date),
      ...(input.pausedDates ?? []),
    ]);
    const dayConfig = { timeZone: settings.timezone, dayStartHour: settings.dayStartHour };

    for (const habit of habits) {
      const habitLogs = logsByHabit.get(habit.id) ?? new Map<IsoDate, HabitLog>();
      // The habit counts from the day it was created, or an earlier back-filled check-in.
      const startDate = habitStartDate(habit, habitLogs.keys(), dayConfig);

      result.set(
        habit.id,
        habitStats({
          habit,
          targets: targetsByHabit.get(habit.id) ?? [],
          logs: habitLogs,
          restDates,
          startDate,
          today,
          dayStartHour: settings.dayStartHour,
          windowDays,
          weekStart: settings.weekStart,
        }),
      );
    }
    return result;
  }, [input]);
}
