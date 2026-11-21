import type { Habit, HabitTarget } from "@/data/schema";
import { minutesIntoDay } from "./day";

/*
 * Scoring one habit on one day (plan.md §5.1).
 * Every habit-day gets two numbers:
 * - done: the target was fully met (used for streaks and ticks),
 * - progress: 0–100, partial credit (used for averages and phase unlock).
 * Example: 3 of 8 glasses → done = false, progress = 37.5.
 */

/** What was logged. Boolean habits use value 1 for "done". */
export interface Entry {
  value: number | null;
  time: string | null;
}

export interface Score {
  done: boolean;
  /** 0–100, rounded to one decimal. */
  progress: number;
}

export type ScorableHabit = Pick<Habit, "type" | "direction">;
export type ScorableTarget = Pick<HabitTarget, "targetValue" | "targetTime" | "graceMinutes">;

/** Progress for a time habit that's late but within the grace window. */
export const GRACE_PROGRESS = 50;

const NOT_DONE: Score = { done: false, progress: 0 };
const DONE: Score = { done: true, progress: 100 };

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.min(100, Math.max(0, n));

export function scoreEntry(
  habit: ScorableHabit,
  target: ScorableTarget | undefined,
  entry: Entry | null,
  dayStartHour: number,
): Score {
  if (!entry) return NOT_DONE;

  switch (habit.type) {
    case "boolean":
      return (entry.value ?? 0) >= 1 ? DONE : NOT_DONE;

    case "time":
      return scoreTime(target, entry.time, dayStartHour);

    case "count":
    case "duration":
    case "numeric":
      return habit.direction === "lower_better"
        ? scoreLowerBetter(target?.targetValue ?? null, entry.value)
        : scoreHigherBetter(target?.targetValue ?? null, entry.value);
  }
}

/** "At least N": 3 of 8 → 37.5%; more than the target is capped at 100%. */
function scoreHigherBetter(target: number | null, value: number | null): Score {
  if (value === null) return NOT_DONE;
  if (!target) return value > 0 ? DONE : NOT_DONE;
  return { done: value >= target, progress: round1(clamp((value / target) * 100)) };
}

/** "At most N" (e.g. reels under 30 min): 45 min against 30 → 66.7%. */
function scoreLowerBetter(target: number | null, value: number | null): Score {
  if (value === null) return NOT_DONE;
  if (target === null) return value === 0 ? DONE : NOT_DONE;
  if (value <= target) return DONE;
  return { done: false, progress: target === 0 ? 0 : round1(clamp((target / value) * 100)) };
}

/**
 * "By HH:mm" (wake up, in bed). On time or early → done. Late but within the grace window →
 * half credit. Later → 0. Times are compared within the logical day, so a 23:30 bedtime and
 * a 00:30 actual time is 60 minutes late (not 23 hours early).
 */
function scoreTime(
  target: ScorableTarget | undefined,
  time: string | null,
  dayStartHour: number,
): Score {
  if (!time) return NOT_DONE;
  if (!target?.targetTime) return DONE;
  const late = minutesIntoDay(time, dayStartHour) - minutesIntoDay(target.targetTime, dayStartHour);
  if (late <= 0) return DONE;
  if (late <= target.graceMinutes) return { done: false, progress: GRACE_PROGRESS };
  return NOT_DONE;
}
