"use client";

import { useMemo } from "react";
import type { HabitTarget } from "@/data/schema";
import { useActivities } from "@/hooks/use-activities";
import {
  useDayStatuses,
  useHabitLogs,
  useHabits,
  useHabitTargets,
  usePhases,
  useSettings,
} from "@/hooks/use-data";
import { useToday } from "@/hooks/use-today";
import { pausedDates, phaseReadiness, type PhaseReadiness } from "@/lib/core";

/**
 * How the current phase is doing against the unlock rule ("Day 9 of 14 · 76%").
 * Shared by Today, Habits and Phases so they always show the same numbers.
 * null while loading.
 */
export function useReadiness(): { readiness: PhaseReadiness | null; paused: Set<string> } {
  const settings = useSettings();
  const phases = usePhases();
  const habits = useHabits();
  const targets = useHabitTargets();
  const logs = useHabitLogs();
  const dayStatuses = useDayStatuses();
  const activities = useActivities();
  const today = useToday();

  return useMemo(() => {
    if (
      !settings.data ||
      !phases.data ||
      !habits.data ||
      !targets.data ||
      !logs.data ||
      !dayStatuses.data ||
      !activities.data ||
      !today
    ) {
      return { readiness: null, paused: new Set<string>() };
    }
    const s = settings.data;
    const targetsByHabit = new Map<string, HabitTarget[]>();
    for (const t of targets.data)
      targetsByHabit.set(t.habitId, [...(targetsByHabit.get(t.habitId) ?? []), t]);
    return {
      paused: pausedDates(phases.data, today),
      readiness: phaseReadiness({
        phases: phases.data,
        habits: habits.data,
        targetsByHabit,
        logs: logs.data,
        dayStatuses: dayStatuses.data,
        activityDates: new Set(activities.data.map((a) => a.date)),
        today,
        config: { timeZone: s.timezone, dayStartHour: s.dayStartHour },
        rules: {
          threshold: s.unlockThreshold,
          windowDays: s.windowDays,
          minLoggedDays: s.minLoggedDays,
        },
      }),
    };
  }, [
    settings.data,
    phases.data,
    habits.data,
    targets.data,
    logs.data,
    dayStatuses.data,
    activities.data,
    today,
  ]);
}
