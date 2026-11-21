import type { HabitSchedule } from "@/data/schema";
import { addDays, diffDays, weekdayIndex, type IsoDate } from "./day";

/**
 * Whether a habit is expected on a given day.
 * - "due": expected that day; counts towards the day's score whether done or not.
 * - "not-due": not expected (e.g. a Monday-only habit on Tuesday); never counts against you.
 * - "flexible": "N times a week" habits. Any day is fine, so a single day never counts
 *   against you; they're judged per week (see weekly quota in streaks.ts). On days they ARE
 *   done, they count as done.
 */
export type DueRole = "due" | "not-due" | "flexible";

type Pauses = readonly { from: IsoDate; to: IsoDate }[] | undefined;

/** Whether a habit is paused on a date (e.g. eased off for back pain). */
export function isPausedOn(pauses: Pauses, date: IsoDate): boolean {
  return (pauses ?? []).some((p) => p.from <= date && date <= p.to);
}

/** Every paused day up to `until`, for streaks (paused days neither add to nor break them). */
export function pausedDays(pauses: Pauses, until: IsoDate): Set<IsoDate> {
  const out = new Set<IsoDate>();
  for (const p of pauses ?? []) {
    for (let d = p.from; d <= p.to && d <= until; d = addDays(d, 1)) out.add(d);
  }
  return out;
}

/**
 * Whether a habit has started counting on a date. `startsOn` missing = started from the
 * beginning; null = not started yet; a date = from that day.
 */
export function isStartedOn(startsOn: IsoDate | null | undefined, date: IsoDate): boolean {
  return startsOn === undefined || (startsOn !== null && date >= startsOn);
}

/** Like dueRole, but a paused habit, or one that hasn't started yet, is never due. */
export function dueRoleOn(
  habit: { schedule: HabitSchedule; pauses?: Pauses; startsOn?: IsoDate | null },
  date: IsoDate,
): DueRole {
  return isPausedOn(habit.pauses, date) || !isStartedOn(habit.startsOn, date)
    ? "not-due"
    : dueRole(habit.schedule, date);
}

export function dueRole(schedule: HabitSchedule, date: IsoDate): DueRole {
  switch (schedule.kind) {
    case "daily":
      return "due";
    case "weekdays":
      return schedule.days.includes(weekdayIndex(date)) ? "due" : "not-due";
    case "everyNDays": {
      const diff = diffDays(date, schedule.anchor);
      return ((diff % schedule.every) + schedule.every) % schedule.every === 0 ? "due" : "not-due";
    }
    case "timesPerWeek":
      return "flexible";
  }
}

/** Where a habit stands on `today`: counting, starting on a later day, or not started yet. */
export type StartState = "started" | "later" | "waiting";

export function startState(startsOn: IsoDate | null | undefined, today: IsoDate): StartState {
  if (startsOn === null) return "waiting";
  if (startsOn !== undefined && startsOn > today) return "later";
  return "started";
}
