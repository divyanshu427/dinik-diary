import { scoreEntry, targetOn, type Entry, type IsoDate, type Score } from "@/lib/core";
import { entryToMetric, setMetric } from "./metric-ops";
import type { DataStore } from "./repositories";
import type { Habit, HabitLog, HabitTarget } from "./schema";

/*
 * Logging a habit on a day (Build Phase 6). The score (done + progress) is always worked out
 * here from the target that applied on that date, so the Today screen, the bot (later) and
 * re-scoring after a target change all agree.
 */

export interface CheckInContext {
  store: DataStore;
  dayStartHour: number;
}

export interface CheckInRequest {
  habit: Pick<Habit, "id" | "type" | "direction"> & Partial<Pick<Habit, "metricKey">>;
  targets: readonly HabitTarget[];
  date: IsoDate;
  /** What was logged. null clears the check-in (e.g. unticking). */
  entry: Entry | null;
  /** Leave undefined to keep the existing note. */
  note?: string;
}

/** The score a check-in would get. Used for instant (optimistic) updates too. */
export function scoreCheckIn(
  req: Pick<CheckInRequest, "habit" | "targets" | "date" | "entry">,
  dayStartHour: number,
): Score {
  return scoreEntry(req.habit, targetOn(req.targets, req.date), req.entry, dayStartHour);
}

/** Saves (or clears) a check-in. Returns the saved row, or null when cleared. */
export async function setCheckIn(
  ctx: CheckInContext,
  req: CheckInRequest,
): Promise<HabitLog | null> {
  const { store, dayStartHour } = ctx;
  const { habit, date, entry, note } = req;

  // A habit that reads a metric (e.g. Daily steps): save the metric; it scores the habit.
  if (habit.metricKey) {
    const metricKey = habit.metricKey;
    return store.atomically(async () => {
      await setMetric(ctx, date, metricKey, entryToMetric(habit, entry));
      const saved = await store.habitLogs.get(habit.id, date);
      if (saved && note !== undefined) return setCheckInNote(ctx, habit.id, date, note);
      return saved ?? null;
    });
  }

  if (!entry || (entry.value === null && entry.time === null)) {
    await store.habitLogs.remove(habit.id, date);
    return null;
  }

  const score = scoreCheckIn(req, dayStartHour);
  return store.habitLogs.upsert(habit.id, date, {
    value: entry.value,
    time: entry.time,
    ...score,
    source: "web",
    ...(note !== undefined ? { note: note.trim() } : {}),
  });
}

/** Changes only the note of an existing check-in. */
export async function setCheckInNote(
  ctx: CheckInContext,
  habitId: string,
  date: IsoDate,
  note: string,
): Promise<HabitLog> {
  const current = await ctx.store.habitLogs.get(habitId, date);
  if (!current) throw new Error("Log the habit first, then add a note.");
  return ctx.store.habitLogs.upsert(habitId, date, {
    value: current.value,
    time: current.time,
    done: current.done,
    progress: current.progress,
    note: note.trim(),
  });
}
