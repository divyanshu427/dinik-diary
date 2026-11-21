import type { HabitSchedule } from "@/data/schema";
import { addDays, eachDay, startOfWeek, type IsoDate, type WeekStart } from "./day";
import { dueRole } from "./schedule";

/*
 * Streaks (plan.md §5.1, §5.5) use `done` only.
 * - Days that aren't due (by schedule) and rest days (rest / sick / travel) are skipped:
 *   they neither add to nor break a streak.
 * - Today never breaks a streak: the day isn't over yet.
 * - "N times a week" habits count streaks in weeks: a week counts when the quota is met.
 */

export interface StreakInput {
  schedule: HabitSchedule;
  /** Dates on which the habit was fully done. */
  doneDates: ReadonlySet<IsoDate>;
  /** Rest, sick and travel days. */
  restDates: ReadonlySet<IsoDate>;
  /** First date to consider (e.g. when the habit started). */
  startDate: IsoDate;
  /** The current logical date. */
  today: IsoDate;
  weekStart: WeekStart;
}

export interface Streak {
  current: number;
  best: number;
  unit: "days" | "weeks";
}

export function computeStreak(input: StreakInput): Streak {
  if (input.startDate > input.today) {
    return { current: 0, best: 0, unit: input.schedule.kind === "timesPerWeek" ? "weeks" : "days" };
  }
  return input.schedule.kind === "timesPerWeek"
    ? weeklyStreak(input, input.schedule.times)
    : dailyStreak(input);
}

function dailyStreak({ schedule, doneDates, restDates, startDate, today }: StreakInput): Streak {
  let run = 0;
  let best = 0;
  for (const date of eachDay(startDate, today)) {
    if (dueRole(schedule, date) === "not-due" || restDates.has(date)) continue;
    if (doneDates.has(date)) {
      run += 1;
      best = Math.max(best, run);
    } else if (date !== today) {
      run = 0;
    }
  }
  return { current: run, best, unit: "days" };
}

function weeklyStreak(
  { doneDates, restDates, startDate, today, weekStart }: StreakInput,
  times: number,
): Streak {
  let run = 0;
  let best = 0;
  const currentWeek = startOfWeek(today, weekStart);

  for (let week = startOfWeek(startDate, weekStart); week <= currentWeek; week = addDays(week, 7)) {
    const days = eachDay(week, addDays(week, 6));
    // Days the habit could have been done: after it started, and not a rest day.
    const available = days.filter((d) => d >= startDate && !restDates.has(d)).length;
    if (available === 0) continue;
    const quota = Math.min(times, available);
    const done = days.filter((d) => doneDates.has(d) && d >= startDate).length;

    if (done >= quota) {
      run += 1;
      best = Math.max(best, run);
    } else if (week !== currentWeek) {
      run = 0;
    }
  }
  return { current: run, best, unit: "weeks" };
}

/** How many times an "N times a week" habit is done in the week containing `date`. */
export function weeklyCount(
  doneDates: ReadonlySet<IsoDate>,
  date: IsoDate,
  weekStart: WeekStart,
): number {
  const start = startOfWeek(date, weekStart);
  return eachDay(start, addDays(start, 6)).filter((d) => doneDates.has(d)).length;
}
