import { copy } from "@/copy";
import type { Category, Metric, MetricKey } from "@/data/schema";
import { MINUTES_PER_DAY, SLEEP_KEY, type IsoDate, type PeriodReport } from "@/lib/core";

/*
 * CSV export of a report period (Build Phase 10): one row per day, opened easily in a
 * spreadsheet. Minutes per category come from the same time allocation as the donut.
 */

const c = copy.pages.reports.csv;

const METRIC_COLUMNS: readonly MetricKey[] = [
  "steps",
  "water",
  "weight",
  "sleep_hours",
  "bed_time",
  "wake_time",
  "screen_time",
  "reels_minutes",
  "mood",
  "energy",
];

/**
 * One CSV cell. Quotes when needed, and stops a spreadsheet from running text that starts
 * with = + - @ as a formula (a category could be called "=SUM(…)").
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface ReportCsvInput {
  report: PeriodReport;
  metrics: readonly Metric[];
  /** In display order. Only categories with time in the period get a column. */
  categories: readonly Pick<Category, "id" | "name">[];
  today: IsoDate;
  /** Minutes of today that have passed (for today's Unlogged column). */
  nowMinute: number | null;
}

export function reportCsv({
  report,
  metrics,
  categories,
  today,
  nowMinute,
}: ReportCsvInput): string {
  const byDay = report.time.byDay;
  const used = new Set<string>();
  for (const minutes of byDay.values()) for (const [k, m] of minutes) if (m > 0) used.add(k);
  const columns = categories.filter((cat) => used.has(cat.id));

  const inPeriod = new Map<string, Metric>();
  for (const m of metrics) inPeriod.set(`${m.date}|${m.key}`, m);

  const header = [
    c.date,
    c.dayType,
    c.habitsDone,
    c.habitsDue,
    c.average,
    c.sleep,
    ...columns.map((cat) => c.minutes(cat.name)),
    c.unlogged,
    ...METRIC_COLUMNS.map((k) => c.metrics[k]),
  ];

  // Logged sleep (bed → wake) has its own column, separate from the category columns.
  const rows = report.days.map((day) => {
    const minutes = byDay.get(day.date) ?? new Map<string, number>();
    const total =
      day.date === today && nowMinute !== null
        ? Math.max(0, Math.min(MINUTES_PER_DAY, nowMinute))
        : MINUTES_PER_DAY;
    const placed = [...minutes.values()].reduce((a, b) => a + b, 0);
    const round = (m: number | undefined) => Math.round(m ?? 0);
    return [
      day.date,
      copy.pages.today.dayType.types[day.dayType],
      day.counted ? day.done : "",
      day.counted || "",
      day.average === null ? "" : Math.round(day.average * 10) / 10,
      round(minutes.get(SLEEP_KEY)),
      ...columns.map((cat) => round(minutes.get(cat.id))),
      Math.max(0, Math.round(total - placed)),
      ...METRIC_COLUMNS.map((k) => {
        const m = inPeriod.get(`${day.date}|${k}`);
        return m ? (m.valueTime ?? m.valueNum) : null;
      }),
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
