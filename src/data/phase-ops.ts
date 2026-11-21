import { setTargetFrom, type OpsContext } from "./habit-ops";
import type { DataStore } from "./repositories";
import type { Phase, PhaseEvent, TargetUpgrade } from "./schema";

/*
 * The phase manager (Build Phase 11): enable, repeat, pause, resume and lock phases.
 * Every action is one atomic step and is written to the phase's history.
 *
 * - Phases stack: enabling a phase keeps the habits of earlier phases on the checklist.
 *   The phase that was being worked on becomes "completed".
 * - Enabling applies the phase's target upgrades from today (e.g. steps 5,000 → 8,000).
 *   Locking it again puts those targets back.
 */

const now = () => new Date().toISOString();

async function addEvent(
  store: DataStore,
  phase: Phase,
  event: PhaseEvent,
  patch: Partial<Phase> = {},
) {
  return store.phases.update(phase.id, { ...patch, history: [...phase.history, event] });
}

async function getPhase(store: DataStore, id: string) {
  const phase = await store.phases.get(id);
  if (!phase) throw new Error("Phase not found");
  return phase;
}

/**
 * Starts a phase (the next one, or any locked one "early"). Earlier active or paused phases
 * become completed, and the phase's target upgrades apply from today.
 */
export function enablePhase(
  ctx: OpsContext,
  id: string,
  options: { early?: boolean } = {},
): Promise<Phase> {
  const { store, today, dayStartHour } = ctx;
  return store.atomically(async () => {
    const phase = await getPhase(store, id);
    if (phase.status !== "locked") throw new Error(`“${phase.name}” is already on.`);

    for (const other of await store.phases.list()) {
      if (other.id !== id && (other.status === "active" || other.status === "paused")) {
        await addEvent(
          store,
          other,
          { date: today, kind: "completed" },
          { status: "completed", endedAt: now() },
        );
      }
    }

    const changes: NonNullable<PhaseEvent["changes"]> = [];
    for (const upgrade of phase.targetUpgrades) {
      const habit = await store.habits.get(upgrade.habitId);
      if (!habit || habit.archived) continue;
      const { habitId: _id, ...to } = upgrade;
      const from = await setTargetFrom(store, habit, to, today, dayStartHour);
      if (from) changes.push({ habitId: habit.id, from, to });
    }

    return addEvent(
      store,
      phase,
      {
        date: today,
        kind: "started",
        ...(options.early ? { early: true } : {}),
        ...(changes.length ? { changes } : {}),
      },
      { status: "active", startedAt: now(), endedAt: null },
    );
  });
}

/** Starts the phase's window again from today (no penalty: "repeat this phase"). */
export function repeatPhase(ctx: OpsContext, id: string): Promise<Phase> {
  const { store, today } = ctx;
  return store.atomically(async () => {
    const phase = await getPhase(store, id);
    return addEvent(store, phase, { date: today, kind: "repeated" });
  });
}

/** Pauses a phase (holiday, illness): paused days don't count in the window or streaks. */
export function pausePhase(ctx: OpsContext, id: string): Promise<Phase> {
  const { store, today } = ctx;
  return store.atomically(async () => {
    const phase = await getPhase(store, id);
    if (phase.status !== "active") return phase;
    return addEvent(store, phase, { date: today, kind: "paused" }, { status: "paused" });
  });
}

export function resumePhase(ctx: OpsContext, id: string): Promise<Phase> {
  const { store, today } = ctx;
  return store.atomically(async () => {
    const phase = await getPhase(store, id);
    if (phase.status !== "paused") return phase;
    return addEvent(store, phase, { date: today, kind: "resumed" }, { status: "active" });
  });
}

/**
 * Turns a phase off again (manual override): its habits leave the checklist, the targets it
 * changed go back to what they were (from today), and the phase before it becomes active again.
 */
export function lockPhase(ctx: OpsContext, id: string): Promise<Phase> {
  const { store, today, dayStartHour } = ctx;
  return store.atomically(async () => {
    const phase = await getPhase(store, id);
    if (phase.status === "locked") return phase;

    const started = [...phase.history].reverse().find((e) => e.kind === "started");
    for (const change of started?.changes ?? []) {
      const habit = await store.habits.get(change.habitId);
      if (habit && change.from) await setTargetFrom(store, habit, change.from, today, dayStartHour);
    }

    const locked = await addEvent(
      store,
      phase,
      { date: today, kind: "locked" },
      { status: "locked", startedAt: null, endedAt: null },
    );

    const all = await store.phases.list();
    const stillOn = all.some((p) => p.status === "active" || p.status === "paused");
    if (!stillOn) {
      const previous = all
        .filter((p) => p.status === "completed")
        .sort((a, b) => b.number - a.number)[0];
      if (previous) {
        await addEvent(
          store,
          previous,
          { date: today, kind: "resumed" },
          { status: "active", endedAt: null },
        );
      }
    }
    return locked;
  });
}

/** The target changes a phase makes when it's enabled. */
export function setTargetUpgrades(
  ctx: OpsContext,
  id: string,
  upgrades: TargetUpgrade[],
): Promise<Phase> {
  const { store } = ctx;
  return store.atomically(async () => {
    // One change per habit: the last one given wins.
    const byHabit = new Map(upgrades.map((u) => [u.habitId, u]));
    return store.phases.update(id, { targetUpgrades: [...byHabit.values()] });
  });
}
