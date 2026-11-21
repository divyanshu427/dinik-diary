/*
 * Days and dates (plan.md §5.2, §5.3).
 *
 * - A "logical day" starts at `dayStartHour` (default 4 AM) in the user's time zone, so
 *   anything before 4 AM still belongs to the previous day.
 * - Dates are "YYYY-MM-DD" strings. Date maths runs in UTC on those strings, so it never
 *   trips over daylight-saving changes.
 * - Times of day are "HH:mm". "Minutes into the day" counts from the day start, so with a
 *   4 AM start: 04:00 → 0, 23:30 → 1170, 02:00 → 1320.
 */

export type IsoDate = string;

export interface DayConfig {
  /** IANA time zone, e.g. "Asia/Kolkata". */
  timeZone: string;
  /** Hour the logical day starts (0–23). */
  dayStartHour: number;
}

export type WeekStart = "monday" | "sunday";

const MS_PER_DAY = 86_400_000;
export const MINUTES_PER_DAY = 1440;

// ---------- calendar dates ----------

function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Parses "YYYY-MM-DD" and rejects impossible dates like 2026-02-30. */
export function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError(`Not a real date: ${date}`);
  }
  return { year, month, day };
}

function toUtcMs(date: IsoDate) {
  const { year, month, day } = parseIsoDate(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): IsoDate {
  const d = new Date(ms);
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / MS_PER_DAY);
}

/** 0 = Monday … 6 = Sunday (matches the habit schedule format). */
export function weekdayIndex(date: IsoDate): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7;
}

export function startOfWeek(date: IsoDate, weekStart: WeekStart): IsoDate {
  const offset = weekStart === "monday" ? weekdayIndex(date) : (weekdayIndex(date) + 1) % 7;
  return addDays(date, -offset);
}

export interface DateRange {
  start: IsoDate;
  /** Inclusive. */
  end: IsoDate;
}

export function weekRange(date: IsoDate, weekStart: WeekStart): DateRange {
  const start = startOfWeek(date, weekStart);
  return { start, end: addDays(start, 6) };
}

export function monthRange(date: IsoDate): DateRange {
  const { year, month } = parseIsoDate(date);
  const start = toIsoDate(year, month, 1);
  const end = fromUtcMs(Date.UTC(year, month, 0)); // day 0 of next month = last day of this one
  return { start, end };
}

/** Every date from `from` to `to`, inclusive. Empty when `to` is before `from`. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const n = diffDays(to, from);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(from, i));
}

// ---------- time zones and the logical day ----------

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Wall-clock date and time of an instant in a time zone. */
export function zonedParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: toIsoDate(Number(parts.year), Number(parts.month), Number(parts.day)),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** The logical date an instant belongs to: before `dayStartHour` counts as the previous day. */
export function logicalDate(instant: Date, config: DayConfig): IsoDate {
  const { date, hour } = zonedParts(instant, config.timeZone);
  return hour < config.dayStartHour ? addDays(date, -1) : date;
}

// ---------- times of day ----------

export function timeToMinutes(time: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) throw new RangeError(`Not an HH:mm time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes since the logical day started (0–1439). */
export function minutesIntoDay(time: string, dayStartHour: number): number {
  return (timeToMinutes(time) - dayStartHour * 60 + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

// ---------- splitting spans across days ----------

export interface Span {
  /** Logical date the span starts on. */
  date: IsoDate;
  startTime: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
}

/** Part of a span inside one logical day, in minutes from that day's start. */
export interface DaySegment {
  date: IsoDate;
  startMinute: number;
  endMinute: number;
}

/**
 * Splits a span into one piece per logical day, e.g. sleep from 23:30 to 07:30 with a 4 AM
 * day start → 23:30–04:00 on the first day and 04:00–07:30 on the next.
 * An end time earlier than the start time means "the next day".
 * Returns null when the span has no start time (it can't be placed on a timeline).
 */
export function splitSpan(span: Span, dayStartHour: number): DaySegment[] | null {
  if (!span.startTime) return null;
  const start = minutesIntoDay(span.startTime, dayStartHour);

  let end: number;
  if (span.endTime) {
    const rawEnd = minutesIntoDay(span.endTime, dayStartHour);
    end = rawEnd < start ? rawEnd + MINUTES_PER_DAY : rawEnd;
  } else if (span.durationMinutes != null) {
    end = start + span.durationMinutes;
  } else {
    return null;
  }

  const segments: DaySegment[] = [];
  let cursor = start;
  while (cursor < end) {
    const dayIndex = Math.floor(cursor / MINUTES_PER_DAY);
    const dayEnd = (dayIndex + 1) * MINUTES_PER_DAY;
    const segmentEnd = Math.min(end, dayEnd);
    segments.push({
      date: addDays(span.date, dayIndex),
      startMinute: cursor - dayIndex * MINUTES_PER_DAY,
      endMinute: segmentEnd - dayIndex * MINUTES_PER_DAY,
    });
    cursor = segmentEnd;
  }
  return segments;
}
