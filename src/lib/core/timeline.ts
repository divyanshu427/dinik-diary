import { addDays, MINUTES_PER_DAY, minutesIntoDay, splitSpan, type IsoDate } from "./day";

/*
 * The day as a timeline (plan.md §5.3, §5.6, §8.5).
 *
 * - Positions are "minutes into the logical day": 0 = the day start (4 AM), 1440 = the next 4 AM.
 * - Sleep is derived: bed time on one day → wake time on the next (crosses midnight, split per day).
 * - One time slot belongs to one entry: when entries overlap, the SHORTER one wins the overlap.
 * - Gaps are waking time with nothing logged.
 */

/** Something placed on the timeline, in minutes into its day. `end` may pass 1440. */
export interface Block {
  id: string;
  start: number;
  end: number;
  /** The whole entry's length when the block is only part of it (e.g. a night cut at 4 AM). */
  size?: number;
}

/** The part of a block that is visible after overlaps are resolved. */
export interface Piece {
  id: string;
  start: number;
  end: number;
}

export interface Overlap {
  /** The shorter entry: it keeps the overlapping time. */
  winnerId: string;
  /** The longer entry: it loses the overlapping time. */
  loserId: string;
  start: number;
  end: number;
}

export interface Gap {
  start: number;
  end: number;
}

const length = (b: { start: number; end: number }) => b.end - b.start;

/** "HH:mm" for a position on the timeline (wraps past midnight and the next day start). */
export function minuteToTime(minute: number, dayStartHour: number): string {
  const clock =
    (((minute + dayStartHour * 60) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
}

/**
 * Where an entry sits within its own day, or null when it has no start time.
 * The end comes from the end time, else start + duration; an end before the start means
 * "after midnight", so 22:30 → 01:00 ends at minute 1260 with a 4 AM day start.
 */
export function blockOf(
  entry: { startTime: string | null; endTime?: string | null; durationMinutes?: number | null },
  dayStartHour: number,
): { start: number; end: number } | null {
  if (!entry.startTime) return null;
  const start = minutesIntoDay(entry.startTime, dayStartHour);
  if (entry.endTime) {
    const end = minutesIntoDay(entry.endTime, dayStartHour);
    return { start, end: end <= start ? end + MINUTES_PER_DAY : end };
  }
  if (entry.durationMinutes != null && entry.durationMinutes > 0) {
    return { start, end: start + entry.durationMinutes };
  }
  return null;
}

/**
 * Resolves overlaps: the shorter block wins any time it shares with a longer one.
 * On a tie, the block listed later wins (usually the one logged more recently).
 * Returns the visible pieces (sorted by start) and every overlapping pair.
 */
export function resolveOverlaps(blocks: readonly Block[]): {
  pieces: Piece[];
  overlaps: Overlap[];
} {
  const ranked = blocks
    .map((b, index) => ({ ...b, index }))
    .filter((b) => length(b) > 0)
    .sort((a, b) => (a.size ?? length(a)) - (b.size ?? length(b)) || b.index - a.index);

  const overlaps: Overlap[] = [];
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const start = Math.max(ranked[i].start, ranked[j].start);
      const end = Math.min(ranked[i].end, ranked[j].end);
      if (end > start) {
        overlaps.push({ winnerId: ranked[i].id, loserId: ranked[j].id, start, end });
      }
    }
  }

  // Shortest first: each block takes whatever is still free.
  const claimed: Gap[] = [];
  const pieces: Piece[] = [];
  for (const block of ranked) {
    for (const part of subtract(block, claimed)) pieces.push({ id: block.id, ...part });
    claimed.push({ start: block.start, end: block.end });
  }
  pieces.sort((a, b) => a.start - b.start || a.end - b.end);
  overlaps.sort((a, b) => a.start - b.start);
  return { pieces, overlaps };
}

/** `range` minus every interval in `cut`, as sorted non-empty parts. */
export function subtract(range: Gap, cut: readonly Gap[]): Gap[] {
  let parts: Gap[] = [{ start: range.start, end: range.end }];
  for (const c of cut) {
    parts = parts.flatMap((p) => {
      if (c.end <= p.start || c.start >= p.end) return [p];
      const out: Gap[] = [];
      if (c.start > p.start) out.push({ start: p.start, end: c.start });
      if (c.end < p.end) out.push({ start: c.end, end: p.end });
      return out;
    });
  }
  return parts.filter((p) => p.end > p.start).sort((a, b) => a.start - b.start);
}

/** Waking time with nothing logged, at least `minMinutes` long. */
export function findGaps(
  blocks: readonly { start: number; end: number }[],
  window: Gap,
  minMinutes: number,
): Gap[] {
  if (window.end <= window.start) return [];
  return subtract(window, blocks).filter((g) => length(g) >= minMinutes);
}

/** Shortest gap the app asks about ("Nothing logged between 2 PM and 5 PM"). */
export const GAP_PROMPT_MINUTES = 120;

// ---------- sleep ----------

/** Minutes asleep from bed time to wake time; a wake time before the bed time is the next morning. */
export function sleepMinutes(bedTime: string, wakeTime: string): number {
  const [bh, bm] = bedTime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  const diff = wh * 60 + wm - (bh * 60 + bm);
  return diff > 0 ? diff : diff + MINUTES_PER_DAY;
}

export interface SleepSegment {
  /** "sleep-before": the night that ended this morning; "sleep-after": tonight. */
  id: "sleep-before" | "sleep-after";
  start: number;
  end: number;
  /** The whole night's length (both days), or null when the bed or wake time is missing. */
  minutes: number | null;
  bedTime: string | null;
  wakeTime: string | null;
}

/** Sleep segments inside one logical day, from the night before it and the night after it. */
export function sleepSegments(params: {
  date: IsoDate;
  dayStartHour: number;
  /** bed_time / wake_time metrics, by logical date. */
  bedTimes: ReadonlyMap<IsoDate, string>;
  wakeTimes: ReadonlyMap<IsoDate, string>;
}): SleepSegment[] {
  const { date, dayStartHour, bedTimes, wakeTimes } = params;
  const out: SleepSegment[] = [];

  // Last night: bed (yesterday) → wake (today). Only the part after the day start is today's.
  const lastBed = bedTimes.get(addDays(date, -1)) ?? null;
  const wake = wakeTimes.get(date) ?? null;
  if (wake) {
    const wakeAt = minutesIntoDay(wake, dayStartHour);
    if (lastBed) {
      const segs =
        splitSpan({ date: addDays(date, -1), startTime: lastBed, endTime: wake }, dayStartHour) ??
        [];
      const today = segs.find((s) => s.date === date);
      if (today) {
        out.push({
          id: "sleep-before",
          start: today.startMinute,
          end: today.endMinute,
          minutes: sleepMinutes(lastBed, wake),
          bedTime: lastBed,
          wakeTime: wake,
        });
      }
    } else if (wakeAt > 0) {
      // Woke up, bed time unknown: asleep from the day start.
      out.push({
        id: "sleep-before",
        start: 0,
        end: wakeAt,
        minutes: null,
        bedTime: null,
        wakeTime: wake,
      });
    }
  }

  // Tonight: bed (today) → wake (tomorrow), or to the end of the day when the wake time isn't known yet.
  const bed = bedTimes.get(date) ?? null;
  if (bed) {
    const nextWake = wakeTimes.get(addDays(date, 1)) ?? null;
    const start = minutesIntoDay(bed, dayStartHour);
    let end = MINUTES_PER_DAY;
    if (nextWake) {
      const segs = splitSpan({ date, startTime: bed, endTime: nextWake }, dayStartHour) ?? [];
      end = segs.find((s) => s.date === date)?.endMinute ?? MINUTES_PER_DAY;
    }
    if (end > start) {
      out.push({
        id: "sleep-after",
        start,
        end,
        minutes: nextWake ? sleepMinutes(bed, nextWake) : null,
        bedTime: bed,
        wakeTime: nextWake,
      });
    }
  }
  return out;
}

// ---------- fixing an overlap ----------

/**
 * What's left of the longer entry once the shorter one keeps the shared time:
 * - nothing (the same time slot) → [],
 * - trimmed at one end → one part,
 * - the shorter one sits inside it → two parts (before and after).
 */
export function overlapRemainder(loser: Gap, winner: Gap): Gap[] {
  return subtract(loser, [winner]);
}
