import { addDays, scoreEntry, sleepMinutes, targetOn, type IsoDate } from "@/lib/core";
import type { DataStore } from "./repositories";
import type { Habit, MetricKey } from "./schema";

/*
 * Daily numbers (Build Phase 8): steps, water, weight, bed and wake time, screen time, reels,
 * mood, energy. One value per metric per day.
 *
 * - A habit linked to a metric (habit.metricKey) reads its value from it: logging steps in the
 *   numbers panel also scores "Daily steps", and logging the habit also saves the metric.
 * - Sleep hours are worked out from bed time (the day before) → wake time (this morning).
 */

export interface MetricContext {
  store: DataStore;
  dayStartHour: number;
}

/** Metrics that hold a time of day ("HH:mm") instead of a number. */
export const TIME_METRICS: ReadonlySet<MetricKey> = new Set(["bed_time", "wake_time"]);

/** Allowed range for each number metric. */
export const METRIC_LIMITS: Record<
  Exclude<MetricKey, "bed_time" | "wake_time">,
  { min: number; max: number; step: number; integer: boolean }
> = {
  steps: { min: 0, max: 200_000, step: 1, integer: true },
  water: { min: 0, max: 20, step: 0.25, integer: false },
  weight: { min: 1, max: 600, step: 0.1, integer: false },
  sleep_hours: { min: 0, max: 24, step: 0.25, integer: false },
  screen_time: { min: 0, max: 1440, step: 1, integer: true },
  reels_minutes: { min: 0, max: 1440, step: 1, integer: true },
  mood: { min: 1, max: 5, step: 1, integer: true },
  energy: { min: 1, max: 5, step: 1, integer: true },
};

/** A metric's value: a number, an "HH:mm" time, or null to clear it. */
export type MetricValue = number | string | null;

/** Whether a number is allowed for a metric (time metrics are checked by the schema). */
export function isValidMetricNumber(key: MetricKey, value: number): boolean {
  if (TIME_METRICS.has(key)) return false;
  const limit = METRIC_LIMITS[key as keyof typeof METRIC_LIMITS];
  return (
    Number.isFinite(value) &&
    value >= limit.min &&
    value <= limit.max &&
    (!limit.integer || Number.isInteger(value))
  );
}

/** Hours, rounded to 2 decimals (7 h 20 min → 7.33). */
const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/**
 * Saves (or clears) one metric for a day, then updates every habit linked to it, and the
 * sleep hours when a bed or wake time changes. All in one step.
 */
export function setMetric(
  ctx: MetricContext,
  date: IsoDate,
  key: MetricKey,
  value: MetricValue,
): Promise<void> {
  const { store } = ctx;
  return store.atomically(async () => {
    if (key !== "bed_time" && key !== "wake_time") {
      await write(ctx, date, key, value);
      return;
    }
    // Bed time on day D belongs to the night that ends on D+1; wake time on D ends the night before D.
    const sleepDate = key === "bed_time" ? addDays(date, 1) : date;
    const before = await nightTimes(store, sleepDate);
    await write(ctx, date, key, value);
    const after = await nightTimes(store, sleepDate);
    if (after.bed && after.wake) {
      await write(ctx, sleepDate, "sleep_hours", toHours(sleepMinutes(after.bed, after.wake)));
    } else if (before.bed && before.wake) {
      // The sleep hours came from the pair that is now incomplete: they no longer hold.
      await write(ctx, sleepDate, "sleep_hours", null);
    }
  });
}

async function nightTimes(store: DataStore, wakeDate: IsoDate) {
  const [bed] = await store.metrics.listRange(
    addDays(wakeDate, -1),
    addDays(wakeDate, -1),
    "bed_time",
  );
  const [wake] = await store.metrics.listRange(wakeDate, wakeDate, "wake_time");
  return { bed: bed?.valueTime ?? null, wake: wake?.valueTime ?? null };
}

async function write(ctx: MetricContext, date: IsoDate, key: MetricKey, value: MetricValue) {
  const { store } = ctx;
  const isTime = TIME_METRICS.has(key);
  if (value === null || value === "") {
    await store.metrics.remove(date, key);
  } else {
    if (isTime !== (typeof value === "string")) {
      throw new TypeError(`${key} expects ${isTime ? "a time" : "a number"}`);
    }
    if (!isTime && !isValidMetricNumber(key, value as number)) {
      throw new RangeError(`${key}: ${value} is out of range`);
    }
    await store.metrics.upsert(date, key, {
      valueNum: isTime ? null : (value as number),
      valueTime: isTime ? (value as string) : null,
    });
  }
  await syncLinkedHabits(ctx, date, key, value === "" ? null : value);
}

/** Scores every (non-archived) habit that reads this metric. */
async function syncLinkedHabits(
  ctx: MetricContext,
  date: IsoDate,
  key: MetricKey,
  value: MetricValue,
) {
  const { store, dayStartHour } = ctx;
  const linked = (await store.habits.list()).filter((h) => h.metricKey === key && !h.archived);
  for (const habit of linked) {
    if (value === null) {
      await store.habitLogs.remove(habit.id, date);
      continue;
    }
    const entry = metricEntry(key, value);
    const targets = await store.habitTargets.listByHabit(habit.id);
    const score = scoreEntry(habit, targetOn(targets, date), entry, dayStartHour);
    await store.habitLogs.upsert(habit.id, date, { ...entry, ...score, source: "web" });
  }
}

/** A metric value as a habit entry. */
export function metricEntry(key: MetricKey, value: number | string) {
  return TIME_METRICS.has(key)
    ? { value: null, time: value as string }
    : { value: value as number, time: null };
}

/** The value a habit check-in saves into its linked metric. */
export function entryToMetric(
  habit: Partial<Pick<Habit, "metricKey">>,
  entry: { value: number | null; time: string | null } | null,
): MetricValue {
  if (!habit.metricKey || !entry) return null;
  return TIME_METRICS.has(habit.metricKey) ? entry.time : entry.value;
}
