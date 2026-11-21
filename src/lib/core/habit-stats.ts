import type { Habit, HabitLog, HabitTarget } from "@/data/schema";
import { addDays, eachDay, logicalDate, type DayConfig, type IsoDate, type WeekStart } from "./day";
import { dueRoleOn, pausedDays } from "./schedule";
import { scoreEntry } from "./scoring";
import { computeStreak, type Streak } from "./streaks";
import { targetOn } from "./targets";

/*
 * One habit's recent history: what happened on each day, its streaks and its success rate.
 * Drives the "last 14 days" dots, the 30-day heatmap and the stats on the Habits screen.
 */

export type DayState =
  /** Target fully met. */
  | "done"
  /** Some progress, target not met (e.g. 3,420 of 5,000 steps). */
  | "partial"
  /** Due, nothing logged, and the day is over. */
  | "missed"
  /** Today, not done yet: the day isn't over. */
  | "today"
  /** Not expected that day (schedule), or a flexible "N times a week" day it wasn't done. */
  | "not-due"
  /** Rest, sick or travel day. */
  | "rest"
  /** Before the habit started. */
  | "before-start"
  | "future";

export interface HabitDay {
  date: IsoDate;
  state: DayState;
  /** 0–100. */
  progress: number;
  /** Counts towards the success rate (a due, non-rest day that's over or already scored). */
  counted: boolean;
}

export interface HabitHistoryInput {
  habit: Pick<Habit, "type" | "direction" | "schedule"> &
    Partial<Pick<Habit, "pauses" | "startsOn">>;
  targets: readonly HabitTarget[];
  /** This habit's check-ins by date. */
  logs: ReadonlyMap<IsoDate, Pick<HabitLog, "value" | "time">>;
  restDates: ReadonlySet<IsoDate>;
  /** First day the habit counts (when it was created, or an earlier back-filled check-in). */
  startDate: IsoDate;
  today: IsoDate;
  dayStartHour: number;
}

export function habitDay(input: HabitHistoryInput, date: IsoDate): HabitDay {
  const { habit, targets, logs, restDates, startDate, today, dayStartHour } = input;
  const notCounted = (state: DayState, progress = 0): HabitDay => ({
    date,
    state,
    progress,
    counted: false,
  });

  if (date > today) return notCounted("future");
  const log = logs.get(date);
  if (date < startDate && !log) return notCounted("before-start");

  const score = scoreEntry(habit, targetOn(targets, date), log ?? null, dayStartHour);
  const role = dueRoleOn(habit, date);
  const rest = restDates.has(date);
  const due = role === "due" && !rest;

  if (score.done) return { date, state: "done", progress: 100, counted: due };
  if (rest) return notCounted("rest", score.progress);
  if (score.progress > 0) return { date, state: "partial", progress: score.progress, counted: due };
  if (!due) return notCounted("not-due");
  if (date === today) return notCounted("today");
  return { date, state: "missed", progress: 0, counted: true };
}

/** Every day from `from` to `to`, inclusive. */
export function habitHistory(input: HabitHistoryInput, from: IsoDate, to: IsoDate): HabitDay[] {
  return eachDay(from, to).map((d) => habitDay(input, d));
}

export interface HabitStats {
  /** The last `windowDays` days, oldest first, ending today. */
  days: HabitDay[];
  streak: Streak;
  /** Success rate over the window, 0–100; null when nothing counted yet. */
  percent: number | null;
  doneDays: number;
}

export function habitStats(
  input: HabitHistoryInput & { windowDays: number; weekStart: WeekStart },
): HabitStats {
  const { windowDays, weekStart, today } = input;
  const days = habitHistory(input, addDays(today, -(windowDays - 1)), today);

  // Streaks look at all history, not just the window.
  const doneDates = new Set<IsoDate>();
  for (const date of input.logs.keys()) {
    if (date <= today && habitDay(input, date).state === "done") doneDates.add(date);
  }
  const streak = computeStreak({
    schedule: input.habit.schedule,
    doneDates,
    restDates: new Set([...input.restDates, ...pausedDays(input.habit.pauses, today)]),
    startDate: input.startDate,
    today,
    weekStart,
  });

  const doneDays = days.filter((d) => d.state === "done").length;
  return { days, streak, percent: successRate(input, days, doneDays), doneDays };
}

/**
 * First day a habit counts: its chosen start date; otherwise the logical day it was created,
 * or an earlier back-filled check-in.
 * Shared by the Habits screen, Today and the reports so they all agree.
 */
export function habitStartDate(
  habit: Pick<Habit, "createdAt"> & Partial<Pick<Habit, "startsOn">>,
  logDates: Iterable<IsoDate>,
  config: DayConfig,
): IsoDate {
  // A chosen start date wins: days before it never count. Not started yet: nothing counts.
  if (typeof habit.startsOn === "string") return habit.startsOn;
  if (habit.startsOn === null) return NOT_STARTED;
  const created = logicalDate(new Date(habit.createdAt), config);
  let start = created;
  for (const d of logDates) if (d < start) start = d;
  return start;
}

/** The "start date" of a habit that hasn't started: later than any real day. */
export const NOT_STARTED: IsoDate = "9999-12-31";

/** Success rate over some days, 0–100 (null when nothing counted). "N times a week" uses the quota. */
export function successRate(
  input: Pick<HabitHistoryInput, "habit">,
  days: readonly HabitDay[],
  doneDays: number,
): number | null {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const schedule = input.habit.schedule;

  // "N times a week": done days against the weekly quota over the days available.
  if (schedule.kind === "timesPerWeek") {
    const available = days.filter(
      (d) => !["before-start", "rest", "future"].includes(d.state),
    ).length;
    if (available === 0) return null;
    const expected = (schedule.times * available) / 7;
    return round1(Math.min(100, (doneDays / expected) * 100));
  }

  const counted = days.filter((d) => d.counted);
  if (counted.length === 0) return null;
  return round1(counted.reduce((sum, d) => sum + d.progress, 0) / counted.length);
}
