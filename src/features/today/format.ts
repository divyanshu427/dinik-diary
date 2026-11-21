import { addDays, parseIsoDate, type IsoDate } from "@/lib/core";

const clockFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const longDate = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long" });
const numberFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

const asLocalDate = (date: IsoDate) => {
  const { year, month, day } = parseIsoDate(date);
  return new Date(year, month - 1, day);
};

/** "07:40" → "7:40 AM" */
export function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return clockFormat.format(new Date(2000, 0, 1, h, m));
}

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/** "2026-11-25" → "25 Nov" */
export const formatShort = (date: IsoDate) => shortDate.format(asLocalDate(date));

/** "2026-11-20" → "Friday, 20 November" */
export const formatLongDate = (date: IsoDate) => longDate.format(asLocalDate(date));

/** Title for the day being viewed: "Today", "Yesterday" or the weekday name. */
export function dayTitle(
  date: IsoDate,
  today: IsoDate,
  labels: { today: string; yesterday: string },
) {
  if (date === today) return labels.today;
  if (date === addDays(today, -1)) return labels.yesterday;
  return weekday.format(asLocalDate(date));
}

/** 3420 → "3,420"; 0.25 → "0.25" */
export const formatNumber = (n: number) => numberFormat.format(n);
