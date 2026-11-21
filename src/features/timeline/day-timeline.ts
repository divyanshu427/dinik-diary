import type { Activity, Metric } from "@/data/schema";
import {
  addDays,
  blockOf,
  findGaps,
  GAP_PROMPT_MINUTES,
  MINUTES_PER_DAY,
  minutesIntoDay,
  resolveOverlaps,
  sleepSegments,
  type Block,
  type Gap,
  type IsoDate,
  type SleepSegment,
} from "@/lib/core";

/*
 * One day as a timeline (Build Phase 8): sleep, timed activities and unlogged gaps, in order.
 * Pure: the Today screen passes in its data and draws the result.
 */

/** Used for the waking window when no wake or bed time is logged for the day. */
export const DEFAULT_WAKE_TIME = "07:00";
export const DEFAULT_BED_TIME = "23:00";

export type TimelineItem =
  | {
      kind: "activity";
      key: string;
      start: number;
      end: number;
      activity: Activity;
      /** Started the day before and runs past the day start. */
      continued: boolean;
    }
  | { kind: "sleep"; key: string; start: number; end: number; sleep: SleepSegment }
  | { kind: "gap"; key: string; start: number; end: number };

export interface TimelineOverlap {
  /** Shorter: keeps the shared time. */
  winner: Activity;
  /** Longer: loses it ("Fix" trims or splits this one). */
  loser: Activity;
  start: number;
  end: number;
}

export interface DayTimeline {
  items: TimelineItem[];
  gaps: Gap[];
  overlaps: TimelineOverlap[];
  /** Entries without a start time: they count, but can't be placed. */
  untimed: Activity[];
  /** Minutes covered by sleep and activities. */
  placedMinutes: number;
  /** The waking part of the day that gaps are looked for in. */
  window: Gap;
}

export interface DayTimelineInput {
  date: IsoDate;
  dayStartHour: number;
  activities: readonly Activity[];
  metrics: readonly Metric[];
  /** Fallback waking window, e.g. the wake-up and bedtime habit targets. */
  defaultWake?: string;
  defaultBed?: string;
  /** Viewing today: minutes into the day right now (gaps stop here). null for past days. */
  nowMinute: number | null;
  minGapMinutes?: number;
}

export function buildDayTimeline(input: DayTimelineInput): DayTimeline {
  const { date, dayStartHour, nowMinute } = input;
  const yesterday = addDays(date, -1);

  const timesOf = (key: "bed_time" | "wake_time") =>
    new Map(
      input.metrics
        .filter((m) => m.key === key && m.valueTime)
        .map((m) => [m.date, m.valueTime!] as const),
    );
  const bedTimes = timesOf("bed_time");
  const wakeTimes = timesOf("wake_time");
  const sleep = sleepSegments({ date, dayStartHour, bedTimes, wakeTimes });

  const blocks: Block[] = [];
  const byId = new Map<string, TimelineItem>();
  const untimed: Activity[] = [];

  for (const s of sleep) {
    blocks.push({ id: s.id, start: s.start, end: s.end, size: s.minutes ?? undefined });
    byId.set(s.id, { kind: "sleep", key: s.id, start: s.start, end: s.end, sleep: s });
  }

  const mine = new Set<string>();
  for (const a of input.activities) {
    if (a.date !== date && a.date !== yesterday) continue;
    const block = blockOf(a, dayStartHour);
    if (a.date === date) {
      if (!block) {
        untimed.push(a);
        continue;
      }
      mine.add(a.id);
      const end = Math.min(block.end, MINUTES_PER_DAY);
      blocks.push({ id: a.id, start: block.start, end, size: block.end - block.start });
      byId.set(a.id, {
        kind: "activity",
        key: a.id,
        start: block.start,
        end,
        activity: a,
        continued: false,
      });
    } else if (block && block.end > MINUTES_PER_DAY) {
      // Yesterday's entry that ran past the day start (e.g. a party until 5 AM).
      const end = block.end - MINUTES_PER_DAY;
      blocks.push({ id: a.id, start: 0, end, size: block.end - block.start });
      byId.set(a.id, { kind: "activity", key: a.id, start: 0, end, activity: a, continued: true });
    }
  }

  const { pieces, overlaps } = resolveOverlaps(blocks);

  const wake = wakeTimes.get(date) ?? input.defaultWake ?? DEFAULT_WAKE_TIME;
  const bed = bedTimes.get(date) ?? input.defaultBed ?? DEFAULT_BED_TIME;
  const windowStart = minutesIntoDay(wake, dayStartHour);
  let windowEnd = minutesIntoDay(bed, dayStartHour);
  if (nowMinute !== null) windowEnd = Math.min(windowEnd, nowMinute);
  const window = { start: windowStart, end: Math.max(windowStart, windowEnd) };
  const gaps = findGaps(pieces, window, input.minGapMinutes ?? GAP_PROMPT_MINUTES);

  const items: TimelineItem[] = [
    ...pieces.map((p, i) => ({
      ...byId.get(p.id)!,
      key: `${p.id}:${i}`,
      start: p.start,
      end: p.end,
    })),
    ...gaps.map((g) => ({
      kind: "gap" as const,
      key: `gap:${g.start}`,
      start: g.start,
      end: g.end,
    })),
  ].sort((a, b) => a.start - b.start || a.end - b.end);

  const activityItem = (id: string) => {
    const item = byId.get(id);
    return item?.kind === "activity" ? item.activity : undefined;
  };

  return {
    items,
    gaps,
    overlaps: overlaps
      .filter((o) => mine.has(o.winnerId) && mine.has(o.loserId))
      .map((o) => ({
        winner: activityItem(o.winnerId)!,
        loser: activityItem(o.loserId)!,
        start: o.start,
        end: o.end,
      })),
    untimed,
    placedMinutes: pieces.reduce((sum, p) => sum + (p.end - p.start), 0),
    window,
  };
}
