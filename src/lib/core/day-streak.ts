import { eachDay, type IsoDate } from "./day";

/*
 * The overall streak on the Today screen: consecutive days where the day's average progress
 * reached the target (by default the 80% phase-unlock target).
 * Rest days and days with nothing due are skipped; today never breaks the streak.
 */

export interface DayStreakInput {
  /** Average progress per day (0–100), or null when nothing was due that day. */
  averages: ReadonlyMap<IsoDate, number | null>;
  restDates: ReadonlySet<IsoDate>;
  from: IsoDate;
  today: IsoDate;
  /** e.g. 80 */
  threshold: number;
}

export function dayStreak({ averages, restDates, from, today, threshold }: DayStreakInput) {
  let current = 0;
  let best = 0;
  for (const date of eachDay(from, today)) {
    const avg = averages.get(date) ?? null;
    if (restDates.has(date) || avg === null) continue;
    if (avg >= threshold) {
      current += 1;
      best = Math.max(best, current);
    } else if (date !== today) {
      current = 0;
    }
  }
  return { current, best };
}

/**
 * Handy quick-add amounts for a target, e.g. 5,000 steps → +500 / +1,000; 3 L → +0.25 / +0.5.
 * Minutes get round numbers: 30 min → +5 / +15; longer → +15 / +30.
 */
export function quickAmounts(
  type: "count" | "duration" | "numeric",
  target: number | null,
): [number, number] {
  if (type === "duration") return target !== null && target > 30 ? [15, 30] : [5, 15];
  if (type === "count" || !target || target <= 0) return [1, 2];
  const nice = [
    0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000,
  ];
  const step = [...nice].reverse().find((n) => n <= target / 10) ?? nice[0];
  return [step, step * 2];
}
