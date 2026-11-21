import type { DayStatus, Habit, HabitTarget } from "@/data/schema";
import type { IsoDate } from "./day";
import { dueRoleOn, type DueRole } from "./schedule";
import { scoreEntry, type Entry, type Score } from "./scoring";
import { targetOn } from "./targets";

/*
 * One day's checklist result: which habits count that day, how each scored, and the
 * day's average progress (the number behind the progress ring and the heatmap).
 */

export type DayType = DayStatus["type"];

export interface HabitDayInput {
  habit: Pick<Habit, "id" | "type" | "direction" | "schedule"> & Partial<Pick<Habit, "pauses">>;
  /** All of this habit's targets; the one valid on the date is picked. */
  targets: readonly HabitTarget[];
  entry: Entry | null;
}

export interface HabitDayResult {
  habitId: string;
  role: DueRole;
  /** Whether this habit counts towards the day's average. */
  counted: boolean;
  score: Score;
  target: HabitTarget | undefined;
  /** Something was entered (even if it scored 0, e.g. woke up late). */
  logged: boolean;
}

export interface DaySummary {
  date: IsoDate;
  dayType: DayType;
  /** Rest, sick and travel days: shown, but skipped by streaks and phase unlock. */
  isRestDay: boolean;
  items: HabitDayResult[];
  countedCount: number;
  doneCount: number;
  /** Average progress of counted habits, 0–100; null when nothing counts that day. */
  averageProgress: number | null;
  /** At least one habit was logged. Used for "logged days" in phase unlock (with activities). */
  hasAnyLog: boolean;
}

export function summarizeDay(params: {
  date: IsoDate;
  habits: readonly HabitDayInput[];
  dayType?: DayType;
  dayStartHour: number;
}): DaySummary {
  const { date, habits, dayType = "normal", dayStartHour } = params;

  const items = habits.map(({ habit, targets, entry }): HabitDayResult => {
    const target = targetOn(targets, date);
    const score = scoreEntry(habit, target, entry, dayStartHour);
    const role = dueRoleOn(habit, date);
    // Flexible ("N times a week") habits count only on days they were done.
    const counted = role === "due" || (role === "flexible" && score.done);
    const logged = entry !== null && (entry.value !== null || entry.time !== null);
    return { habitId: habit.id, role, counted, score, target, logged };
  });

  const counted = items.filter((i) => i.counted);
  const averageProgress = counted.length
    ? Math.round((counted.reduce((sum, i) => sum + i.score.progress, 0) / counted.length) * 10) / 10
    : null;

  return {
    date,
    dayType,
    isRestDay: dayType !== "normal",
    items,
    countedCount: counted.length,
    doneCount: counted.filter((i) => i.score.done).length,
    averageProgress,
    hasAnyLog: items.some((i) => i.logged),
  };
}
