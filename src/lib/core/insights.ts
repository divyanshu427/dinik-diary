import type { MetricKey } from "@/data/schema";
import { addDays, minutesIntoDay, weekdayIndex, type IsoDate } from "./day";
import type { HabitDay } from "./habit-stats";
import type { PeriodReport, ReportComparison } from "./reports";

/*
 * Rule-based insights (plan.md §8.6), no AI. Each rule needs enough days to be sure, and a
 * clear difference, so they only fire on real patterns. The engine returns structured facts;
 * the screens turn them into sentences (copy file).
 */

export type Tone = "positive" | "negative" | "neutral";

export type Insight =
  /** "Average progress 72%, up 9 points from last week." */
  | { kind: "progress-change"; tone: Tone; current: number; previous: number; change: number }
  /** "Reels averaged 52 min/day, up 20% from last week." */
  | {
      kind: "metric-change";
      tone: Tone;
      metric: MetricKey;
      average: number;
      previous: number;
      changePct: number;
    }
  /** "You skipped Face wash — night on 6 of the 7 days you skipped Healthy breakfast." */
  | {
      kind: "skip-together";
      tone: Tone;
      habitId: string;
      withHabitId: string;
      both: number;
      of: number;
    }
  /** "Days after going to bed by 11:30 PM averaged 84%, against 61% after later nights." */
  | {
      kind: "bedtime-effect";
      tone: Tone;
      bedBy: string;
      earlyAverage: number;
      lateAverage: number;
      earlyDays: number;
      lateDays: number;
    }
  /** "Work and job search: 50 min a day more than last week." (per day, so a part-done month compares fairly) */
  | {
      kind: "category-change";
      tone: Tone;
      categoryId: string;
      perDay: number;
      previousPerDay: number;
    };

/** Minimum days on each side of a comparison. */
export const MIN_DAYS = 3;
const PROGRESS_POINTS = 5;
const METRIC_PCT = 15;
const SKIP_MIN = 4;
const SKIP_RATIO = 0.75;
const SKIP_LIFT = 0.4;
const BEDTIME_POINTS = 10;
/** Minutes a day. */
const CATEGORY_MINUTES = 30;
const CATEGORY_PCT = 30;

/** Metrics where less is better. */
const LOWER_IS_BETTER: ReadonlySet<MetricKey> = new Set(["reels_minutes", "screen_time"]);
const COMPARED_METRICS: readonly MetricKey[] = [
  "reels_minutes",
  "screen_time",
  "steps",
  "sleep_hours",
  "water",
];

export interface PeriodInsightInput {
  report: PeriodReport;
  previous: PeriodReport | null;
  comparison: ReportComparison | null;
  dayStartHour: number;
  /** Bed time to compare against, e.g. the "In bed on time" target ("23:30"). */
  bedBy: string | null;
  /** bed_time metrics by the date you went to bed (covering the day before the period too). */
  bedTimes: ReadonlyMap<IsoDate, string>;
}

/** Insights for a period, most useful first. */
export function periodInsights(input: PeriodInsightInput): Insight[] {
  const out: Insight[] = [];
  const { report, previous, comparison } = input;

  if (comparison && previous && report.scoredDays >= MIN_DAYS && previous.scoredDays >= MIN_DAYS) {
    const p = comparison.averageProgress;
    if (p.change !== null && Math.abs(p.change) >= PROGRESS_POINTS) {
      out.push({
        kind: "progress-change",
        tone: p.change > 0 ? "positive" : "negative",
        current: p.current!,
        previous: p.previous!,
        change: p.change,
      });
    }
  }

  out.push(...skipTogether(report));

  const bed = bedtimeEffect(input);
  if (bed) out.push(bed);

  if (comparison && previous) {
    for (const metric of COMPARED_METRICS) {
      const c = comparison.metrics[metric];
      const daysNow = report.metrics[metric]?.days ?? 0;
      const daysBefore = previous.metrics[metric]?.days ?? 0;
      if (!c || c.changePct === null || daysNow < MIN_DAYS || daysBefore < MIN_DAYS) continue;
      if (Math.abs(c.changePct) < METRIC_PCT) continue;
      const better = LOWER_IS_BETTER.has(metric) ? c.changePct < 0 : c.changePct > 0;
      out.push({
        kind: "metric-change",
        tone: better ? "positive" : "negative",
        metric,
        average: c.current!,
        previous: c.previous!,
        changePct: c.changePct,
      });
    }

    if (report.days.length >= MIN_DAYS && previous.days.length >= MIN_DAYS) {
      for (const [categoryId, c] of comparison.categories) {
        if (c.change === null || Math.abs(c.change) < CATEGORY_MINUTES) continue;
        if (c.previous! > 0 && Math.abs(c.changePct ?? 0) < CATEGORY_PCT) continue;
        out.push({
          kind: "category-change",
          tone: "neutral",
          categoryId,
          perDay: c.current!,
          previousPerDay: c.previous!,
        });
      }
    }
  }
  return out;
}

const skipped = (d: HabitDay) => d.counted && d.state !== "done";

/**
 * "You skipped B on 6 of the 7 days you skipped A": B is skipped on most days A is skipped,
 * and much more often than on days A is done (so it's a link, not just a habit you often skip).
 */
export function skipTogether(report: PeriodReport, limit = 2): Insight[] {
  const found: (Insight & { kind: "skip-together"; lift: number })[] = [];
  for (const a of report.habits) {
    const aDays = new Map(a.days.map((d) => [d.date, d]));
    for (const b of report.habits) {
      if (a === b) continue;
      // Pair up the two habits' counted days.
      const pairs: { weekday: number; aSkip: boolean; bSkip: boolean }[] = [];
      for (const bd of b.days) {
        const ad = aDays.get(bd.date);
        if (!ad || !bd.counted || !ad.counted) continue;
        pairs.push({ weekday: weekdayIndex(bd.date), aSkip: skipped(ad), bSkip: skipped(bd) });
      }
      // Compare like with like: on each weekday, how often is B skipped when A is kept?
      // Otherwise two habits that are both weaker on weekdays would look linked when they aren't.
      const keptRate = new Map<number, { n: number; skips: number }>();
      for (const p of pairs) {
        if (p.aSkip) continue;
        const r = keptRate.get(p.weekday) ?? { n: 0, skips: 0 };
        r.n += 1;
        if (p.bSkip) r.skips += 1;
        keptRate.set(p.weekday, r);
      }
      const aSkipDays = pairs.filter((p) => p.aSkip);
      // A weekday needs at least two "kept" days to compare against; one day says nothing.
      const matched = aSkipDays.filter((p) => (keptRate.get(p.weekday)?.n ?? 0) >= 2);
      const aKept = pairs.length - aSkipDays.length;
      if (aSkipDays.length < SKIP_MIN || matched.length < SKIP_MIN || aKept < SKIP_MIN) continue;

      const both = aSkipDays.filter((p) => p.bSkip).length;
      const ratio = both / aSkipDays.length;
      const matchedRatio = matched.filter((p) => p.bSkip).length / matched.length;
      const expected =
        matched.reduce((sum, p) => {
          const r = keptRate.get(p.weekday)!;
          return sum + r.skips / r.n;
        }, 0) / matched.length;
      const lift = matchedRatio - expected;
      if (ratio >= SKIP_RATIO && lift >= SKIP_LIFT) {
        found.push({
          kind: "skip-together",
          tone: "negative",
          habitId: b.habitId,
          withHabitId: a.habitId,
          both,
          of: aSkipDays.length,
          lift,
        });
      }
    }
  }
  // Most evidence first ("6 of 7 days" beats "6 of 6"); skip the mirror of a pair already shown.
  found.sort((x, y) => y.both - x.both || y.of - x.of || y.lift - x.lift);
  const out: Insight[] = [];
  const seen = new Set<string>();
  for (const { lift: _lift, ...insight } of found) {
    const pair = [insight.habitId, insight.withHabitId].sort().join("|");
    if (seen.has(pair)) continue;
    seen.add(pair);
    out.push(insight);
    if (out.length >= limit) break;
  }
  return out;
}

/** Do days after an earlier bed time go better? Only reported when they clearly do. */
export function bedtimeEffect(input: PeriodInsightInput): Insight | null {
  const { report, bedBy, bedTimes, dayStartHour } = input;
  if (!bedBy) return null;
  const limit = minutesIntoDay(bedBy, dayStartHour);
  const early: number[] = [];
  const late: number[] = [];
  for (const d of report.days) {
    if (!d.complete || d.rest || d.average === null) continue;
    const bed = bedTimes.get(addDays(d.date, -1));
    if (!bed) continue;
    (minutesIntoDay(bed, dayStartHour) <= limit ? early : late).push(d.average);
  }
  if (early.length < MIN_DAYS || late.length < MIN_DAYS) return null;
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const earlyAverage = avg(early);
  const lateAverage = avg(late);
  if (earlyAverage - lateAverage < BEDTIME_POINTS) return null;
  return {
    kind: "bedtime-effect",
    tone: "positive",
    bedBy,
    earlyAverage,
    lateAverage,
    earlyDays: early.length,
    lateDays: late.length,
  };
}

// ---------- per habit (Habits panel) ----------

export type HabitInsight =
  /** "You hit this most on weekends and miss it Tuesday to Thursday." */
  | {
      kind: "weekday-pattern";
      best: "weekends" | "weekdays" | null;
      /** Weekday indexes (0 = Monday), a run of 1–3 days; null when there's no weak stretch. */
      worst: [from: number, to: number] | null;
    }
  /** "Up from 40% to 75% over the last two weeks." */
  | { kind: "trend"; recent: number; before: number };

const WEEKEND = new Set([5, 6]);
const PATTERN_POINTS = 25;
const WEAK_POINTS = 25;
const MIN_PER_WEEKDAY = 3;
const TREND_WINDOW = 14;
const TREND_MIN_DAYS = 7;
const TREND_POINTS = 25;

/** Patterns in one habit's history (oldest first; e.g. the last 8 weeks). */
export function habitInsights(days: readonly HabitDay[]): HabitInsight[] {
  const counted = days.filter((d) => d.counted);
  const out: HabitInsight[] = [];
  if (counted.length < 14) return out;

  const rate = (xs: readonly HabitDay[]) =>
    xs.length ? (xs.filter((d) => d.state === "done").length / xs.length) * 100 : 0;
  const overall = rate(counted);

  const weekend = counted.filter((d) => WEEKEND.has(weekdayIndex(d.date)));
  const weekday = counted.filter((d) => !WEEKEND.has(weekdayIndex(d.date)));
  let best: "weekends" | "weekdays" | null = null;
  if (weekend.length >= MIN_PER_WEEKDAY * 2 && weekday.length >= MIN_PER_WEEKDAY * 2) {
    const diff = rate(weekend) - rate(weekday);
    if (diff >= PATTERN_POINTS) best = "weekends";
    else if (diff <= -PATTERN_POINTS) best = "weekdays";
  }

  // A short run of weak weekdays (Monday → Sunday, no wrapping), 1–3 days long. A day is weak
  // when it's well below its own group (weekdays or weekends, once one of them stands out), or
  // below the overall rate otherwise. Longer runs aren't a "stretch" and aren't reported.
  const perDay = Array.from({ length: 7 }, (_, i) =>
    counted.filter((d) => weekdayIndex(d.date) === i),
  );
  const baseline = (i: number) => (best ? rate(WEEKEND.has(i) ? weekend : weekday) : overall);
  const weak = perDay.map(
    (xs, i) => xs.length >= MIN_PER_WEEKDAY && rate(xs) <= baseline(i) - WEAK_POINTS,
  );
  let worst: [number, number] | null = null;
  for (let i = 0; i < 7; i++) {
    if (!weak[i]) continue;
    let j = i;
    while (j + 1 < 7 && weak[j + 1]) j++;
    if (j - i <= 2 && (!worst || j - i > worst[1] - worst[0])) worst = [i, j];
    i = j;
  }
  // "Most on weekends" and a weak weekend day would contradict each other.
  if (worst && best === "weekends" && WEEKEND.has(worst[0])) worst = null;
  if (worst && best === "weekdays" && !WEEKEND.has(worst[0])) worst = null;
  if (best || worst) out.push({ kind: "weekday-pattern", best, worst });

  const recent = counted.slice(-TREND_WINDOW);
  const before = counted.slice(-TREND_WINDOW * 2, -TREND_WINDOW);
  if (recent.length >= TREND_MIN_DAYS && before.length >= TREND_MIN_DAYS) {
    const avg = (xs: HabitDay[]) => xs.reduce((s, d) => s + d.progress, 0) / xs.length;
    const r = Math.round(avg(recent));
    const b = Math.round(avg(before));
    if (Math.abs(r - b) >= TREND_POINTS) out.push({ kind: "trend", recent: r, before: b });
  }
  return out;
}
