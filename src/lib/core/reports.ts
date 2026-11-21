import type {
  Activity,
  DayStatus,
  Habit,
  HabitLog,
  HabitTarget,
  Metric,
  MetricKey,
} from "@/data/schema";
import {
  addDays,
  eachDay,
  MINUTES_PER_DAY,
  minutesIntoDay,
  monthRange,
  weekRange,
  type DateRange,
  type DayConfig,
  type IsoDate,
  type WeekStart,
} from "./day";
import { summarizeDay, type DayType } from "./day-summary";
import { dayStreak } from "./day-streak";
import { habitHistory, habitStartDate, successRate, type HabitDay } from "./habit-stats";
import { pausedDays } from "./schedule";
import { computeStreak, type Streak } from "./streaks";
import { blockOf, resolveOverlaps, sleepSegments, type Block } from "./timeline";

/*
 * The report engine (Build Phase 9, plan.md §8). Every number on the Reports screen and the
 * habit panels comes from here, for any period: a week, a month, or all time.
 *
 * Rules:
 * - Days run 4 AM → 4 AM; entries crossing the day start are split between days.
 * - Days after today are never counted. Today counts once it's fully done; until then it's
 *   left out of averages so an unfinished day doesn't drag them down.
 * - Rest, sick and travel days are shown but left out of averages, best/worst and streaks.
 * - Time allocation: minutes per category ÷ all minutes in the period (24 h × days), with
 *   sleep from bed → wake time, overlaps resolved (shorter wins) and the rest as "Unlogged".
 */

// ---------- periods ----------

export type PeriodKind = "week" | "month" | "all";

/** The period containing `date`. "All time" runs from `earliest` (first data) to `date`. */
export function periodRange(
  kind: PeriodKind,
  date: IsoDate,
  weekStart: WeekStart,
  earliest?: IsoDate,
): DateRange {
  if (kind === "week") return weekRange(date, weekStart);
  if (kind === "month") return monthRange(date);
  return { start: earliest && earliest < date ? earliest : date, end: date };
}

/** The period before: last week, last month. All time has none. */
export function previousPeriod(kind: PeriodKind, range: DateRange): DateRange | null {
  if (kind === "week") return { start: addDays(range.start, -7), end: addDays(range.end, -7) };
  if (kind === "month") return monthRange(addDays(range.start, -1));
  return null;
}

// ---------- input and output ----------

export interface ReportData {
  /** The habits to score (usually: not archived, in an unlocked phase). */
  habits: readonly Habit[];
  targetsByHabit: ReadonlyMap<string, readonly HabitTarget[]>;
  logs: readonly HabitLog[];
  dayStatuses: readonly DayStatus[];
  activities: readonly Activity[];
  metrics: readonly Metric[];
  /** Sleep (bed → wake) counts under this category; null keeps it as its own "sleep" slice. */
  sleepCategoryId: string | null;
  /** Days a phase was paused: treated like rest days. */
  pausedDates?: ReadonlySet<IsoDate>;
}

export interface ReportConfig extends DayConfig {
  weekStart: WeekStart;
  /** Average progress that makes a "good" day (the phase-unlock target, e.g. 80). */
  threshold: number;
  today: IsoDate;
  /** Minutes into today right now; time allocation for today stops here. */
  nowMinute?: number | null;
}

export interface DayReport {
  date: IsoDate;
  dayType: DayType;
  rest: boolean;
  /** Average progress 0–100, null when nothing was due. */
  average: number | null;
  counted: number;
  done: number;
  /** Over (a past day), or today with everything done. */
  complete: boolean;
  /** Any habit or activity was logged. */
  logged: boolean;
}

export interface HabitReport {
  habitId: string;
  /** Each day of the period (heatmap rows, ranking, per-habit insights). */
  days: HabitDay[];
  /** Success rate in the period, 0–100; null when nothing counted. */
  percent: number | null;
  doneDays: number;
  countedDays: number;
  /** As of the end of the period, over all history. */
  streak: Streak;
}

export const SLEEP_KEY = "__sleep";
export const UNLOGGED_KEY = "__unlogged";

export interface Slice {
  /** A category id, SLEEP_KEY or UNLOGGED_KEY. */
  key: string;
  minutes: number;
  /** One decimal; all slices add up to exactly 100. */
  percent: number;
}

export interface TimeAllocation {
  /** Minutes per key (category id or SLEEP_KEY) for each day, e.g. for the CSV export. */
  byDay: Map<IsoDate, Map<string, number>>;
  totalMinutes: number;
  sleepMinutes: number;
  /** Share of all 24 hours (sleep included). */
  day: Slice[];
  /** Share of waking time (logged sleep left out). */
  waking: Slice[];
}

export interface CategoryReport {
  categoryId: string;
  entries: number;
  /** Sum of the entries' durations. */
  minutes: number;
  /** Entries logged without a duration. */
  missingDuration: number;
  activityIds: string[];
}

export interface MetricReport {
  key: MetricKey;
  /** Days with a value. */
  days: number;
  /** Number metrics. */
  total: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
  first: number | null;
  last: number | null;
  /** Time metrics (bed / wake): the average time of day, "HH:mm". */
  averageTime: string | null;
}

export interface PeriodReport {
  range: DateRange;
  /** Days in the period up to today. */
  days: DayReport[];
  /** Average of complete, non-rest days with something due. */
  averageProgress: number | null;
  /** Complete, non-rest days used for the average. */
  scoredDays: number;
  daysFullyDone: number;
  daysAtThreshold: number;
  loggedDays: number;
  restDays: number;
  bestDay: { date: IsoDate; average: number } | null;
  worstDay: { date: IsoDate; average: number } | null;
  /** Days in a row at or above the threshold, as of the end of the period. */
  streak: { current: number; best: number };
  habits: HabitReport[];
  time: TimeAllocation;
  categories: CategoryReport[];
  metrics: Partial<Record<MetricKey, MetricReport>>;
}

// ---------- the engine ----------

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildReport(
  data: ReportData,
  range: DateRange,
  config: ReportConfig,
): PeriodReport {
  const { today, dayStartHour } = config;
  const end = range.end < today ? range.end : today;
  const dates = end >= range.start ? eachDay(range.start, end) : [];
  const inPeriod = (d: IsoDate) => d >= range.start && d <= end;

  const dayTypes = new Map(data.dayStatuses.map((s) => [s.date, s.type]));
  const restDates = new Set([
    ...data.dayStatuses.filter((s) => s.type !== "normal").map((s) => s.date),
    ...(data.pausedDates ?? []),
  ]);

  // ----- habits -----
  const logsByHabit = new Map<string, Map<IsoDate, HabitLog>>();
  for (const log of data.logs) {
    if (!logsByHabit.has(log.habitId)) logsByHabit.set(log.habitId, new Map());
    logsByHabit.get(log.habitId)!.set(log.date, log);
  }
  const habitInputs = data.habits.map((habit) => {
    const logs = logsByHabit.get(habit.id) ?? new Map<IsoDate, HabitLog>();
    return {
      habit,
      targets: data.targetsByHabit.get(habit.id) ?? [],
      logs,
      startDate: habitStartDate(habit, logs.keys(), config),
    };
  });

  const summarize = (date: IsoDate) =>
    summarizeDay({
      date,
      dayType: dayTypes.get(date) ?? "normal",
      dayStartHour,
      habits: habitInputs
        .filter((h) => h.startDate <= date)
        .map((h) => {
          const log = h.logs.get(date);
          return {
            habit: h.habit,
            targets: h.targets,
            entry: log ? { value: log.value, time: log.time } : null,
          };
        }),
    });

  const activityDates = new Set(data.activities.map((a) => a.date));
  const days: DayReport[] = dates.map((date) => {
    const s = summarize(date);
    const allDone = s.countedCount > 0 && s.doneCount === s.countedCount;
    return {
      date,
      dayType: s.dayType,
      rest: s.isRestDay,
      average: s.averageProgress,
      counted: s.countedCount,
      done: s.doneCount,
      complete: date < today || allDone,
      logged: s.hasAnyLog || activityDates.has(date),
    };
  });

  const scored = days.filter((d) => d.complete && !d.rest && d.average !== null);
  const averageProgress = scored.length
    ? round1(scored.reduce((sum, d) => sum + d.average!, 0) / scored.length)
    : null;

  let bestDay: PeriodReport["bestDay"] = null;
  let worstDay: PeriodReport["worstDay"] = null;
  if (scored.length >= 2) {
    for (const d of scored) {
      // Ties go to the later day.
      if (!bestDay || d.average! >= bestDay.average)
        bestDay = { date: d.date, average: d.average! };
      if (!worstDay || d.average! <= worstDay.average)
        worstDay = { date: d.date, average: d.average! };
    }
    // Every day the same: there's no best or worst day to point at.
    if (bestDay && worstDay && bestDay.average === worstDay.average) {
      bestDay = null;
      worstDay = null;
    }
  }

  // Overall streak over all history up to the end of the period.
  const firstStart = habitInputs.reduce<IsoDate | null>(
    (min, h) => (min === null || h.startDate < min ? h.startDate : min),
    null,
  );
  const averages = new Map<IsoDate, number | null>();
  if (firstStart && firstStart <= end) {
    for (const date of eachDay(firstStart, end))
      averages.set(date, summarize(date).averageProgress);
  }
  const streak =
    firstStart && firstStart <= end
      ? dayStreak({
          averages,
          restDates,
          from: firstStart,
          today: end,
          threshold: config.threshold,
        })
      : { current: 0, best: 0 };

  const habits: HabitReport[] = habitInputs.map((h) => {
    const input = {
      habit: h.habit,
      targets: h.targets,
      logs: h.logs,
      restDates,
      startDate: h.startDate,
      today,
      dayStartHour,
    };
    const habitDays = dates.length ? habitHistory(input, range.start, end) : [];
    const doneDays = habitDays.filter((d) => d.state === "done").length;
    const doneDates = new Set<IsoDate>();
    for (const [date, log] of h.logs) if (date <= end && log.done) doneDates.add(date);
    return {
      habitId: h.habit.id,
      days: habitDays,
      percent: successRate(input, habitDays, doneDays),
      doneDays,
      countedDays: habitDays.filter((d) => d.counted).length,
      streak: computeStreak({
        schedule: h.habit.schedule,
        doneDates,
        restDates: new Set([...restDates, ...pausedDays(h.habit.pauses, end)]),
        startDate: h.startDate,
        today: end,
        weekStart: config.weekStart,
      }),
    };
  });

  return {
    range,
    days,
    averageProgress,
    scoredDays: scored.length,
    daysFullyDone: days.filter((d) => !d.rest && d.counted > 0 && d.done === d.counted).length,
    daysAtThreshold: scored.filter((d) => d.average! >= config.threshold).length,
    loggedDays: days.filter((d) => d.logged).length,
    restDays: days.filter((d) => d.rest).length,
    bestDay,
    worstDay,
    streak,
    habits,
    time: timeAllocation(data, dates, config),
    categories: categoryTotals(data.activities.filter((a) => inPeriod(a.date))),
    metrics: metricReports(
      data.metrics.filter((m) => inPeriod(m.date)),
      dayStartHour,
    ),
  };
}

// ---------- time allocation ----------

/** Minutes per key (category id or SLEEP_KEY) placed on one day, capped at `dayTotal`. */
export function dayMinutes(params: {
  date: IsoDate;
  dayStartHour: number;
  /** Activities of this day and the day before (for entries that ran past the day start). */
  activities: readonly Activity[];
  bedTimes: ReadonlyMap<IsoDate, string>;
  wakeTimes: ReadonlyMap<IsoDate, string>;
  /** Minutes of the day that count: 1440, or less for today. */
  dayTotal?: number;
}): Map<string, number> {
  const { date, dayStartHour } = params;
  const dayTotal = params.dayTotal ?? MINUTES_PER_DAY;
  const yesterday = addDays(date, -1);
  const blocks: Block[] = [];
  const keyOf = new Map<string, string>();
  const untimed: Activity[] = [];

  for (const s of sleepSegments({
    date,
    dayStartHour,
    bedTimes: params.bedTimes,
    wakeTimes: params.wakeTimes,
  })) {
    blocks.push({ id: s.id, start: s.start, end: s.end, size: s.minutes ?? undefined });
    keyOf.set(s.id, SLEEP_KEY);
  }
  for (const a of params.activities) {
    const block = blockOf(a, dayStartHour);
    if (a.date === date) {
      if (!block) {
        if (a.durationMinutes) untimed.push(a);
        continue;
      }
      blocks.push({
        id: a.id,
        start: block.start,
        end: Math.min(block.end, MINUTES_PER_DAY),
        size: block.end - block.start,
      });
      keyOf.set(a.id, a.categoryId);
    } else if (a.date === yesterday && block && block.end > MINUTES_PER_DAY) {
      blocks.push({
        id: a.id,
        start: 0,
        end: block.end - MINUTES_PER_DAY,
        size: block.end - block.start,
      });
      keyOf.set(a.id, a.categoryId);
    }
  }

  const minutes = new Map<string, number>();
  const add = (key: string, m: number) => m > 0 && minutes.set(key, (minutes.get(key) ?? 0) + m);
  let placed = 0;
  for (const p of resolveOverlaps(blocks).pieces) {
    const m = Math.max(0, Math.min(p.end, dayTotal) - Math.max(p.start, 0));
    add(keyOf.get(p.id)!, m);
    placed += m;
  }

  // Entries with only a duration can't be placed: they fill free time, scaled down if needed.
  const free = Math.max(0, dayTotal - placed);
  const wanted = untimed.reduce((sum, a) => sum + (a.durationMinutes ?? 0), 0);
  const scale = wanted > free ? free / wanted : 1;
  for (const a of untimed) add(a.categoryId, (a.durationMinutes ?? 0) * scale);
  return minutes;
}

function timeAllocation(
  data: ReportData,
  dates: readonly IsoDate[],
  config: ReportConfig,
): TimeAllocation {
  const timesOf = (key: "bed_time" | "wake_time") =>
    new Map(
      data.metrics
        .filter((m) => m.key === key && m.valueTime)
        .map((m) => [m.date, m.valueTime!] as const),
    );
  const bedTimes = timesOf("bed_time");
  const wakeTimes = timesOf("wake_time");
  const byDate = new Map<IsoDate, Activity[]>();
  for (const a of data.activities) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);

  const totals = new Map<string, number>();
  const byDay = new Map<IsoDate, Map<string, number>>();
  let totalMinutes = 0;
  for (const date of dates) {
    const dayTotal =
      date === config.today && config.nowMinute != null
        ? Math.max(0, Math.min(MINUTES_PER_DAY, config.nowMinute))
        : MINUTES_PER_DAY;
    totalMinutes += dayTotal;
    const minutes = dayMinutes({
      date,
      dayStartHour: config.dayStartHour,
      activities: [...(byDate.get(addDays(date, -1)) ?? []), ...(byDate.get(date) ?? [])],
      bedTimes,
      wakeTimes,
      dayTotal,
    });
    byDay.set(date, minutes);
    for (const [key, m] of minutes) totals.set(key, (totals.get(key) ?? 0) + m);
  }

  const sleepMinutes = totals.get(SLEEP_KEY) ?? 0;

  // 24 h view: sleep joins its category when there is one.
  const dayTotals = new Map(totals);
  if (data.sleepCategoryId && sleepMinutes > 0) {
    dayTotals.delete(SLEEP_KEY);
    dayTotals.set(data.sleepCategoryId, (dayTotals.get(data.sleepCategoryId) ?? 0) + sleepMinutes);
  }
  const wakingTotals = new Map(totals);
  wakingTotals.delete(SLEEP_KEY);

  return {
    byDay,
    totalMinutes,
    sleepMinutes,
    day: toSlices(dayTotals, totalMinutes),
    waking: toSlices(wakingTotals, totalMinutes - sleepMinutes),
  };
}

/** Slices by minutes (most first), "Unlogged" last, percentages adding up to exactly 100. */
export function toSlices(totals: ReadonlyMap<string, number>, base: number): Slice[] {
  const entries = [...totals].filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  const used = entries.reduce((sum, [, m]) => sum + m, 0);
  const unlogged = Math.max(0, base - used);
  const all: [string, number][] = unlogged > 0 ? [...entries, [UNLOGGED_KEY, unlogged]] : entries;
  const total = Math.max(base, used);
  if (total <= 0) return [];

  // Largest-remainder rounding to one decimal, so the shares always add up to 100.0.
  const tenths = all.map(([, m]) => (m / total) * 1000);
  const floors = tenths.map(Math.floor);
  let left = 1000 - floors.reduce((a, b) => a + b, 0);
  const order = tenths
    .map((t, i) => ({ i, rest: t - Math.floor(t) }))
    .sort((a, b) => b.rest - a.rest);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return all.map(([key, minutes], i) => ({
    key,
    minutes: Math.round(minutes),
    percent: floors[i] / 10,
  }));
}

// ---------- categories and metrics ----------

/** "Travel and exploration: 4 entries, 11 h", most time first. */
export function categoryTotals(activities: readonly Activity[]): CategoryReport[] {
  const map = new Map<string, CategoryReport>();
  for (const a of activities) {
    const c = map.get(a.categoryId) ?? {
      categoryId: a.categoryId,
      entries: 0,
      minutes: 0,
      missingDuration: 0,
      activityIds: [],
    };
    c.entries += 1;
    c.minutes += a.durationMinutes ?? 0;
    if (a.durationMinutes == null) c.missingDuration += 1;
    c.activityIds.push(a.id);
    map.set(a.categoryId, c);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes || b.entries - a.entries);
}

function metricReports(
  metrics: readonly Metric[],
  dayStartHour: number,
): Partial<Record<MetricKey, MetricReport>> {
  const byKey = new Map<MetricKey, Metric[]>();
  for (const m of metrics) byKey.set(m.key, [...(byKey.get(m.key) ?? []), m]);

  const out: Partial<Record<MetricKey, MetricReport>> = {};
  for (const [key, rows] of byKey) {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const nums = sorted.map((m) => m.valueNum).filter((v): v is number => v !== null);
    const times = sorted.map((m) => m.valueTime).filter((v): v is string => v !== null);
    const total = nums.length ? nums.reduce((a, b) => a + b, 0) : null;
    let averageTime: string | null = null;
    if (times.length) {
      // Averaged within the logical day, so 23:30 and 00:30 average to midnight, not noon.
      const avg = Math.round(
        times.reduce((sum, t) => sum + minutesIntoDay(t, dayStartHour), 0) / times.length,
      );
      const clock = (avg + dayStartHour * 60) % MINUTES_PER_DAY;
      averageTime = `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
    }
    out[key] = {
      key,
      days: sorted.length,
      total: total === null ? null : round2(total),
      average: total === null ? null : round2(total / nums.length),
      min: nums.length ? Math.min(...nums) : null,
      max: nums.length ? Math.max(...nums) : null,
      first: nums[0] ?? null,
      last: nums.at(-1) ?? null,
      averageTime,
    };
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- comparison ----------

export interface Change {
  current: number | null;
  previous: number | null;
  /** current − previous; null when either is missing. */
  change: number | null;
  /** Percent change; null when the previous value is 0 or missing. */
  changePct: number | null;
}

export function change(current: number | null, previous: number | null): Change {
  if (current === null || previous === null) {
    return { current, previous, change: null, changePct: null };
  }
  return {
    current,
    previous,
    change: round1(current - previous),
    changePct: previous === 0 ? null : Math.round(((current - previous) / previous) * 100),
  };
}

export interface ReportComparison {
  averageProgress: Change;
  daysFullyDone: Change;
  /** Minutes per day per category (logged durations ÷ days in each period, so lengths can differ). */
  categories: Map<string, Change>;
  /** Average per day with a value, for number metrics. */
  metrics: Partial<Record<MetricKey, Change>>;
}

export function compareReports(current: PeriodReport, previous: PeriodReport): ReportComparison {
  const categories = new Map<string, Change>();
  const ids = new Set([
    ...current.categories.map((c) => c.categoryId),
    ...previous.categories.map((c) => c.categoryId),
  ]);
  const perDay = (r: PeriodReport, id: string) =>
    r.days.length
      ? Math.round((r.categories.find((c) => c.categoryId === id)?.minutes ?? 0) / r.days.length)
      : 0;
  for (const id of ids) categories.set(id, change(perDay(current, id), perDay(previous, id)));
  const metrics: Partial<Record<MetricKey, Change>> = {};
  for (const key of new Set([
    ...Object.keys(current.metrics),
    ...Object.keys(previous.metrics),
  ]) as Set<MetricKey>) {
    metrics[key] = change(
      current.metrics[key]?.average ?? null,
      previous.metrics[key]?.average ?? null,
    );
  }
  return {
    averageProgress: change(current.averageProgress, previous.averageProgress),
    daysFullyDone: change(current.daysFullyDone, previous.daysFullyDone),
    categories,
    metrics,
  };
}
