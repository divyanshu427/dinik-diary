import { addDays, targetOn, type IsoDate, type HabitChange, type TargetValues } from "@/lib/core";
import { rescoreFrom, setTargetFrom, type OpsContext } from "./habit-ops";
import type { DataStore } from "./repositories";
import type { Concern, ConcernUpdate, HealthAdjustment, HealthKind } from "./schema";

/*
 * Health (Build Phase 12): issues, daily check-ins, day notes and the temporary changes the
 * "plan for the next few days" makes once I approve them. Every change is one atomic step.
 */

/** What the health issue form produces. */
export interface HealthIssueDraft {
  title: string;
  kind: HealthKind;
  bodyArea: string;
  startedAt: IsoDate;
  severity: number;
  worseWith: string;
  helpsWith: string;
  triedSoFar: string;
  notes: string;
  linkedHabitIds: string[];
  strainHabitIds: string[];
  /** A note for today's first check-in (only when adding). */
  note?: string;
}

const clean = (d: HealthIssueDraft) => ({
  title: d.title.trim(),
  kind: d.kind,
  bodyArea: d.bodyArea.trim(),
  startedAt: d.startedAt,
  severity: d.severity,
  worseWith: d.worseWith.trim(),
  helpsWith: d.helpsWith.trim(),
  triedSoFar: d.triedSoFar.trim(),
  notes: d.notes.trim(),
  linkedHabitIds: [...new Set(d.linkedHabitIds)],
  // A habit can't both help and make it worse.
  strainHabitIds: [...new Set(d.strainHabitIds)].filter((id) => !d.linkedHabitIds.includes(id)),
});

/** Adds an issue, and its first check-in (today, at the level given). */
export function createHealthIssue(ctx: OpsContext, draft: HealthIssueDraft): Promise<Concern> {
  const { store, today } = ctx;
  return store.atomically(async () => {
    const issue = await store.concerns.create({
      ...clean(draft),
      description: "",
      status: "active",
      adjustments: [],
      dismissed: [],
    });
    await upsertCheckIn(store, issue.id, today, draft.severity, draft.note ?? "");
    return issue;
  });
}

export function updateHealthIssue(
  ctx: OpsContext,
  id: string,
  draft: HealthIssueDraft,
): Promise<Concern> {
  return ctx.store.concerns.update(id, clean(draft));
}

export function setHealthStatus(
  ctx: OpsContext,
  id: string,
  status: Concern["status"],
): Promise<Concern> {
  return ctx.store.atomically(async () => {
    const issue = await ctx.store.concerns.update(id, { status });
    // Resolved: anything the plan changed for it ends today.
    if (status === "resolved") {
      for (const a of issue.adjustments) {
        if (a.endedOn === null && a.to >= ctx.today) await endAdjustmentIn(ctx, issue, a.id);
      }
    }
    return (await ctx.store.concerns.get(id))!;
  });
}

/** Deletes an issue and its check-ins. Changes it made to habits end today. */
export function deleteHealthIssue(ctx: OpsContext, id: string): Promise<void> {
  return ctx.store.atomically(async () => {
    const issue = await ctx.store.concerns.get(id);
    if (!issue) return;
    for (const a of issue.adjustments) {
      if (a.endedOn === null && a.to >= ctx.today) await endAdjustmentIn(ctx, issue, a.id);
    }
    await ctx.store.concerns.remove(id);
  });
}

// ---------- check-ins and notes ----------

async function upsertCheckIn(
  store: DataStore,
  concernId: string,
  date: IsoDate,
  severity: number,
  note: string | undefined,
): Promise<ConcernUpdate> {
  const existing = (await store.concernUpdates.listByConcern(concernId)).find(
    (u) => u.date === date,
  );
  if (existing) {
    return store.concernUpdates.update(existing.id, {
      severity,
      ...(note !== undefined ? { note: note.trim() } : {}),
    });
  }
  return store.concernUpdates.create({
    concernId,
    date,
    severity,
    note: note?.trim() ?? "",
    photoRef: null,
  });
}

/** How an issue is on a day (one check-in per issue per day). Leave `note` out to keep it. */
export function checkIn(
  ctx: OpsContext,
  concernId: string,
  date: IsoDate,
  severity: number,
  note?: string,
): Promise<ConcernUpdate> {
  return ctx.store.atomically(() => upsertCheckIn(ctx.store, concernId, date, severity, note));
}

export function deleteCheckIn(ctx: OpsContext, id: string): Promise<void> {
  return ctx.store.concernUpdates.remove(id);
}

/** A general health note for the day ("slept badly, headache in the evening"). */
export function setDayNote(ctx: OpsContext, date: IsoDate, note: string) {
  const { store } = ctx;
  return store.atomically(async () => {
    const current = await store.dayStatus.get(date);
    return store.dayStatus.set(date, { type: current?.type ?? "normal", note: note.trim() });
  });
}

/** Marks a day as Sick (streaks and the phase window skip it). Keeps the day's note. */
export function markSickDay(ctx: OpsContext, date: IsoDate) {
  const { store } = ctx;
  return store.atomically(async () => {
    const current = await store.dayStatus.get(date);
    return store.dayStatus.set(date, { type: "sick", note: current?.note ?? "" });
  });
}

export function dismissSuggestion(ctx: OpsContext, issueId: string, key: string) {
  return ctx.store.atomically(async () => {
    const issue = await ctx.store.concerns.get(issueId);
    if (!issue) return;
    // Keep the list short: old keys (tied to old check-ins) don't matter any more.
    const dismissed = [...issue.dismissed.slice(-30), key];
    await ctx.store.concerns.update(issueId, { dismissed });
  });
}

// ---------- changing a habit for a few days ----------

/**
 * Changes a habit from today for `days` days: a lower or higher target (that goes back by
 * itself afterwards), or a pause. Recorded on the issue so it can end early.
 */
export function applyChange(
  ctx: OpsContext,
  issueId: string,
  habitId: string,
  change: HabitChange,
  days: number,
): Promise<HealthAdjustment> {
  const { store, today, dayStartHour } = ctx;
  return store.atomically(async () => {
    const issue = await store.concerns.get(issueId);
    const habit = await store.habits.get(habitId);
    if (!issue || !habit) throw new Error("Not found");
    const to = addDays(today, days - 1);
    const id = `adj-${today}-${habitId}-${Math.random().toString(36).slice(2, 8)}`;

    let adjustment: HealthAdjustment;
    if (change.mode === "pause") {
      await store.habits.update(habitId, { pauses: [...habit.pauses, { from: today, to }] });
      adjustment = {
        id,
        kind: "pause",
        habitId,
        from: today,
        to,
        previous: null,
        eased: null,
        endedOn: null,
      };
    } else {
      const current = targetOn(await store.habitTargets.listByHabit(habitId), today);
      const previous: TargetValues = {
        targetValue: current?.targetValue ?? null,
        targetTime: current?.targetTime ?? null,
        graceMinutes: current?.graceMinutes ?? 0,
      };
      await setTargetFrom(store, habit, change.values, today, dayStartHour);
      await setTargetFrom(store, habit, previous, addDays(to, 1), dayStartHour);
      adjustment = {
        id,
        kind: change.mode === "lower" ? "ease" : change.mode,
        habitId,
        from: today,
        to,
        previous,
        eased: change.values,
        endedOn: null,
      };
    }
    await store.concerns.update(issueId, { adjustments: [...issue.adjustments, adjustment] });
    return adjustment;
  });
}

/** Ends a change early, from today: the habit is back to normal today. */
export function endAdjustment(ctx: OpsContext, issueId: string, adjustmentId: string) {
  return ctx.store.atomically(async () => {
    const issue = await ctx.store.concerns.get(issueId);
    if (issue) await endAdjustmentIn(ctx, issue, adjustmentId);
  });
}

async function endAdjustmentIn(ctx: OpsContext, issue: Concern, adjustmentId: string) {
  const { store, today, dayStartHour } = ctx;
  const a = issue.adjustments.find((x) => x.id === adjustmentId);
  if (!a || a.endedOn !== null) return;
  const habit = await store.habits.get(a.habitId);

  if (habit && today <= a.to) {
    if (a.kind === "pause") {
      const pauses = habit.pauses
        .map((p) => (p.from === a.from && p.to === a.to ? { ...p, to: addDays(today, -1) } : p))
        .filter((p) => p.from <= p.to);
      await store.habits.update(habit.id, { pauses });
    } else if (a.previous) {
      const targets = await store.habitTargets.listByHabit(habit.id);
      const eased = targets.find((t) => t.validFrom === a.from && t.validTo === a.to);
      const restored = targets.find((t) => t.validFrom === addDays(a.to, 1));
      if (eased && restored) {
        // The normal target simply starts today instead of after the change.
        if (today <= a.from) await store.habitTargets.remove(eased.id);
        else await store.habitTargets.update(eased.id, { validTo: addDays(today, -1) });
        await store.habitTargets.update(restored.id, {
          validFrom: today <= a.from ? a.from : today,
        });
        await rescoreFrom(store, habit, today, dayStartHour);
      } else {
        // The targets were edited by hand meanwhile: just put the old target back from today.
        await setTargetFrom(store, habit, a.previous, today, dayStartHour);
      }
    }
  }
  await store.concerns.update(issue.id, {
    adjustments: issue.adjustments.map((x) =>
      x.id === adjustmentId ? { ...x, endedOn: today } : x,
    ),
  });
}

/** Marks a habit as one that helps this issue (e.g. after adding it from a suggestion). */
export function linkHelpingHabit(ctx: OpsContext, issueId: string, habitId: string) {
  return ctx.store.atomically(async () => {
    const issue = await ctx.store.concerns.get(issueId);
    if (!issue || issue.linkedHabitIds.includes(habitId)) return;
    await ctx.store.concerns.update(issueId, {
      linkedHabitIds: [...issue.linkedHabitIds, habitId],
      strainHabitIds: issue.strainHabitIds.filter((id) => id !== habitId),
    });
  });
}

/** Brings back a suggestion I said "OK" or "Not now" to. */
export function undismissSuggestion(ctx: OpsContext, issueId: string, key: string) {
  return ctx.store.atomically(async () => {
    const issue = await ctx.store.concerns.get(issueId);
    if (!issue) return;
    await ctx.store.concerns.update(issueId, {
      dismissed: issue.dismissed.filter((k) => k !== key),
    });
  });
}
