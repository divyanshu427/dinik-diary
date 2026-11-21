import {
  addDays,
  planTargetChange,
  scoreEntry,
  targetOn,
  type IsoDate,
  type TargetValues,
} from "@/lib/core";
import type { DataStore } from "./repositories";
import type { Habit, Phase } from "./schema";

/*
 * Habit and phase editing (Build Phase 5). Every change that touches more than one row runs
 * atomically, so a failure never leaves half-edited data.
 */

export interface OpsContext {
  store: DataStore;
  /** Current logical date: target changes apply from here. */
  today: IsoDate;
  dayStartHour: number;
}

/** What the habit form produces. */
export interface HabitDraft {
  name: string;
  description: string;
  type: Habit["type"];
  unit: string;
  direction: Habit["direction"];
  schedule: Habit["schedule"];
  partOfDay: Habit["partOfDay"];
  phaseId: string;
  categoryId: string | null;
  target: TargetValues;
}

/** Changing how a habit is measured would make its past check-ins meaningless. */
export class HabitLockedError extends Error {
  constructor() {
    super(
      "This habit already has check-ins, so how it's measured can't change. Create a new habit instead.",
    );
    this.name = "HabitLockedError";
  }
}

// ---------- keys ----------

/** A stable machine name from the habit name, e.g. "Drink water!" → "drink_water". Unique. */
export function makeHabitKey(name: string, existing: ReadonlySet<string>): string {
  const base =
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "habit";
  if (!existing.has(base)) return base;
  for (let n = 2; ; n++) {
    const key = `${base}_${n}`;
    if (!existing.has(key)) return key;
  }
}

const sameTarget = (a: TargetValues | undefined, b: TargetValues) =>
  !!a &&
  a.targetValue === b.targetValue &&
  a.targetTime === b.targetTime &&
  a.graceMinutes === b.graceMinutes;

/** Only the fields that matter for the habit's type are kept. */
export function normalizeTarget(type: Habit["type"], t: TargetValues): TargetValues {
  if (type === "boolean") return { targetValue: null, targetTime: null, graceMinutes: 0 };
  if (type === "time")
    return { targetValue: null, targetTime: t.targetTime, graceMinutes: t.graceMinutes };
  return { targetValue: t.targetValue, targetTime: null, graceMinutes: 0 };
}

async function nextSortOrder(store: DataStore, phaseId: string) {
  const list = await store.habits.listByPhase(phaseId);
  return list.reduce((max, h) => Math.max(max, h.sortOrder), -1) + 1;
}

// ---------- habits ----------

export function createHabit(ctx: OpsContext, draft: HabitDraft): Promise<Habit> {
  const { store, today } = ctx;
  return store.atomically(async () => {
    const keys = new Set((await store.habits.list()).map((h) => h.key));
    const phase = await store.phases.get(draft.phaseId);
    const habit = await store.habits.create({
      key: makeHabitKey(draft.name, keys),
      name: draft.name.trim(),
      description: draft.description.trim(),
      type: draft.type,
      unit: draft.unit.trim(),
      direction: draft.direction,
      schedule: draft.schedule,
      phaseId: draft.phaseId,
      categoryId: draft.categoryId,
      metricKey: null,
      partOfDay: draft.partOfDay,
      pauses: [],
      // A new habit in a running phase starts today; in a locked phase it waits for the phase.
      startsOn: phase && isUnlocked(phase) ? today : null,
      archived: false,
      sortOrder: await nextSortOrder(store, draft.phaseId),
    });
    await store.habitTargets.create({
      habitId: habit.id,
      ...normalizeTarget(draft.type, draft.target),
      validFrom: today,
      validTo: null,
    });
    return habit;
  });
}

/**
 * Saves edits. A changed target starts today (past days keep the old one), and today's and
 * later check-ins are re-scored against it.
 */
export function updateHabit(ctx: OpsContext, id: string, draft: HabitDraft): Promise<Habit> {
  const { store, today, dayStartHour } = ctx;
  return store.atomically(async () => {
    const current = await store.habits.get(id);
    if (!current) throw new Error("Habit not found");

    const measurementChanged = current.type !== draft.type || current.direction !== draft.direction;
    if (measurementChanged && (await store.habitLogs.countForHabit(id)) > 0) {
      throw new HabitLockedError();
    }

    const habit = await store.habits.update(id, {
      name: draft.name.trim(),
      description: draft.description.trim(),
      type: draft.type,
      unit: draft.unit.trim(),
      direction: draft.direction,
      schedule: draft.schedule,
      partOfDay: draft.partOfDay,
      categoryId: draft.categoryId,
      ...(draft.phaseId !== current.phaseId
        ? { phaseId: draft.phaseId, sortOrder: await nextSortOrder(store, draft.phaseId) }
        : {}),
    });

    await setTargetFrom(
      store,
      habit,
      normalizeTarget(draft.type, draft.target),
      today,
      dayStartHour,
    );
    return habit;
  });
}

/**
 * Gives a habit a new target from `from` on (earlier days keep theirs), then re-scores the
 * check-ins from that day. Does nothing when the target is already the same.
 * Returns the target it had before, or null when nothing changed.
 */
export async function setTargetFrom(
  store: DataStore,
  habit: Habit,
  values: TargetValues,
  from: IsoDate,
  dayStartHour: number,
): Promise<TargetValues | null> {
  const targets = await store.habitTargets.listByHabit(habit.id);
  const before = targetOn(targets, from);
  if (sameTarget(before, values)) return null;
  const change = planTargetChange(habit.id, targets, values, from);
  if (change.kind === "update") {
    await store.habitTargets.update(change.id, change.values);
  } else {
    if (change.kind === "split") {
      await store.habitTargets.update(change.close.id, { validTo: change.close.validTo });
    }
    await store.habitTargets.create(change.create);
  }
  await rescoreFrom(store, habit, from, dayStartHour);
  return before
    ? {
        targetValue: before.targetValue,
        targetTime: before.targetTime,
        graceMinutes: before.graceMinutes,
      }
    : { targetValue: null, targetTime: null, graceMinutes: 0 };
}

/** Recomputes done/progress for a habit's check-ins on or after `from`. */
export async function rescoreFrom(
  store: DataStore,
  habit: Habit,
  from: IsoDate,
  dayStartHour: number,
) {
  const targets = await store.habitTargets.listByHabit(habit.id);
  const logs = (await store.habitLogs.listByHabit(habit.id)).filter((l) => l.date >= from);
  for (const log of logs) {
    const score = scoreEntry(habit, targetOn(targets, log.date), log, dayStartHour);
    if (score.done !== log.done || score.progress !== log.progress) {
      await store.habitLogs.upsert(habit.id, log.date, {
        value: log.value,
        time: log.time,
        source: log.source,
        rawMessageId: log.rawMessageId,
        ...score,
      });
    }
  }
}

/** Habits can only be dragged or moved into a phase that isn't locked. */
export class PhaseLockedError extends Error {
  constructor(phaseName: string) {
    super(`“${phaseName}” is locked. Habits can only be moved into unlocked phases.`);
    this.name = "PhaseLockedError";
  }
}

/** A phase you can move habits into: anything that isn't locked. */
export const isUnlocked = (phase: Pick<Phase, "status">) => phase.status !== "locked";

/**
 * Puts a habit at `index` among the visible habits of `phaseId` (used by drag and drop).
 * Moving into a different phase is only allowed when that phase is unlocked.
 * Reordering inside the habit's own phase is always allowed.
 */
export function placeHabit(
  ctx: OpsContext,
  id: string,
  phaseId: string,
  index: number,
): Promise<void> {
  const { store } = ctx;
  return store.atomically(async () => {
    const habit = await store.habits.get(id);
    if (!habit) throw new Error("Habit not found");

    if (phaseId !== habit.phaseId) {
      const phase = await store.phases.get(phaseId);
      if (!phase) throw new Error("Phase not found");
      if (!isUnlocked(phase)) throw new PhaseLockedError(phase.name);
    }

    const list = (await store.habits.listByPhase(phaseId)).filter(
      (h) => !h.archived && h.id !== id,
    );
    list.splice(Math.max(0, Math.min(index, list.length)), 0, habit);

    for (const [i, h] of list.entries()) {
      const patch =
        h.id === id && phaseId !== habit.phaseId ? { phaseId, sortOrder: i } : { sortOrder: i };
      if (h.sortOrder !== i || "phaseId" in patch) await store.habits.update(h.id, patch);
    }
  });
}

/** Moves a habit to the end of another (unlocked) phase. */
export function moveHabit(ctx: OpsContext, id: string, phaseId: string): Promise<void> {
  return placeHabit(ctx, id, phaseId, Number.MAX_SAFE_INTEGER);
}

/** Moves a habit one place up or down among the visible (not archived) habits of its phase. */
export function reorderHabit(ctx: OpsContext, id: string, direction: "up" | "down"): Promise<void> {
  const { store } = ctx;
  return store.atomically(async () => {
    const habit = await store.habits.get(id);
    if (!habit) return;
    const list = (await store.habits.listByPhase(habit.phaseId)).filter((h) => !h.archived);
    const from = list.findIndex((h) => h.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    // Rewrite 0..n so gaps or duplicates from older data get tidied up too.
    for (const [i, h] of list.entries()) {
      if (h.sortOrder !== i) await store.habits.update(h.id, { sortOrder: i });
    }
  });
}

export function setHabitArchived(ctx: OpsContext, id: string, archived: boolean): Promise<Habit> {
  return ctx.store.habits.update(id, { archived });
}

/** Deletes a habit and all its check-ins and targets. */
export function deleteHabit(ctx: OpsContext, id: string): Promise<void> {
  return ctx.store.habits.remove(id);
}

// ---------- phases ----------

export interface PhaseDraft {
  name: string;
  description: string;
}

export function createPhase(ctx: OpsContext, draft: PhaseDraft): Promise<Phase> {
  const { store } = ctx;
  return store.atomically(async () => {
    const phases = await store.phases.list();
    return store.phases.create({
      number: phases.reduce((max, p) => Math.max(max, p.number), 0) + 1,
      name: draft.name.trim(),
      description: draft.description.trim(),
      status: "locked",
      startedAt: null,
      endedAt: null,
      targetUpgrades: [],
      history: [],
    });
  });
}

export function updatePhase(ctx: OpsContext, id: string, draft: PhaseDraft): Promise<Phase> {
  return ctx.store.phases.update(id, {
    name: draft.name.trim(),
    description: draft.description.trim(),
  });
}

async function sortedPhases(store: DataStore) {
  return (await store.phases.list()).sort((a, b) => a.number - b.number);
}

/** Swaps a phase with its neighbour, so Phase 3 can become Phase 2 and so on. */
export function reorderPhase(ctx: OpsContext, id: string, direction: "up" | "down"): Promise<void> {
  const { store } = ctx;
  return store.atomically(async () => {
    const list = await sortedPhases(store);
    const from = list.findIndex((p) => p.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    for (const [i, p] of list.entries()) {
      if (p.number !== i + 1) await store.phases.update(p.id, { number: i + 1 });
    }
  });
}

/** Deletes an empty phase and renumbers the rest. Throws InUseError if it still has habits. */
export function deletePhase(ctx: OpsContext, id: string): Promise<void> {
  const { store } = ctx;
  return store.atomically(async () => {
    await store.phases.remove(id);
    for (const [i, p] of (await sortedPhases(store)).entries()) {
      if (p.number !== i + 1) await store.phases.update(p.id, { number: i + 1 });
    }
  });
}

/**
 * Pauses a habit for `days` days from today: it isn't due, so streaks and the phase average
 * aren't hurt. Replaces any pause that's still running.
 */
export function pauseHabit(ctx: OpsContext, id: string, days: number): Promise<void> {
  const { store, today } = ctx;
  return store.atomically(async () => {
    const habit = await store.habits.get(id);
    if (!habit) return;
    const pauses = endRunningPauses(habit, today);
    await store.habits.update(id, {
      pauses: [...pauses, { from: today, to: addDays(today, days - 1) }],
    });
  });
}

/** Ends a running pause: the habit is due again from today. */
export function resumeHabit(ctx: OpsContext, id: string): Promise<void> {
  const { store, today } = ctx;
  return store.atomically(async () => {
    const habit = await store.habits.get(id);
    if (habit) await store.habits.update(id, { pauses: endRunningPauses(habit, today) });
  });
}

/** Past pauses stay (they explain old days); one covering today now ends yesterday. */
function endRunningPauses(habit: Habit, today: IsoDate) {
  return habit.pauses
    .filter((p) => p.from <= today || p.to < today)
    .map((p) => (p.from <= today && today <= p.to ? { ...p, to: addDays(today, -1) } : p))
    .filter((p) => p.from <= p.to);
}

/**
 * When a habit starts counting: a date (it joins Today and the phase average from that day;
 * earlier days are never missed), or null for "not started yet".
 */
export function setHabitStart(
  ctx: OpsContext,
  id: string,
  startsOn: IsoDate | null,
): Promise<Habit> {
  return ctx.store.habits.update(id, { startsOn });
}

/** Starts several habits from the same day. */
export function startHabits(ctx: OpsContext, ids: readonly string[], from: IsoDate): Promise<void> {
  const { store } = ctx;
  return store.atomically(async () => {
    for (const id of ids) await store.habits.update(id, { startsOn: from });
  });
}

/**
 * The first-run question "Which habits do you want to start with?": the chosen Phase 1 habits
 * count from the beginning (so filling in yesterday still works), the rest of Phase 1 waits.
 * `"all"` starts every one of them.
 */
export function completeFirstRun(
  ctx: OpsContext,
  chosen: readonly string[] | "all",
): Promise<void> {
  const { store } = ctx;
  return store.atomically(async () => {
    const first = (await sortedPhases(store))[0];
    if (first) {
      for (const habit of await store.habits.listByPhase(first.id)) {
        if (habit.archived) continue;
        const start = chosen === "all" || chosen.includes(habit.id) ? undefined : null;
        await store.habits.update(habit.id, { startsOn: start });
      }
    }
    await store.settings.update({ firstRunDone: true });
  });
}
