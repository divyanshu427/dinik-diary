import type { DayStatus, Habit, HabitLog, HabitTarget, Phase } from "@/data/schema";
import { addDays, eachDay, logicalDate, type DayConfig, type IsoDate } from "./day";
import { summarizeDay } from "./day-summary";
import { habitStartDate } from "./habit-stats";

/*
 * Phase readiness (plan.md §4 "Phase unlock rules", Build Phase 11).
 *
 * - The window is the last `windowDays` days of the current phase, not counting rest, sick,
 *   travel or paused days. It starts again when the phase starts or is repeated.
 * - Only finished days are judged (today is shown, but counts from tomorrow).
 * - A logged day has at least one habit check-in or one activity.
 * - Ready when the window is full, it has at least `minLoggedDays` logged days, and the
 *   average progress of those logged days reaches the target (e.g. 80%).
 * - Scheduled habits count only on days they're due (same rules as the Today ring).
 */

export interface ReadinessRules {
  /** Average progress needed, e.g. 80. */
  threshold: number;
  windowDays: number;
  minLoggedDays: number;
}

export type ReadinessState =
  /** No active or paused phase. */
  | "no-phase"
  | "paused"
  /** The window isn't full yet ("Day 9 of 14"). */
  | "in-progress"
  | "too-few-logged"
  | "below-target"
  | "ready";

export interface ReadinessDay {
  date: IsoDate;
  /** Average progress that day, 0–100; null when nothing was due. */
  average: number | null;
  logged: boolean;
  /** Today: shown, not judged yet. */
  today: boolean;
}

export interface HabitStrength {
  habitId: string;
  /** Average progress on the days it counted in the window. */
  percent: number;
}

export interface PhaseReadiness {
  /** The phase being worked on: the highest-numbered active or paused one. */
  phase: Phase | null;
  /** The next locked phase, if any. */
  next: Phase | null;
  state: ReadinessState;
  cycleStart: IsoDate | null;
  /** "Day 9 of 14": days of the window so far, today included, at most `windowDays`. */
  dayNumber: number;
  /** The window for the chart: up to `windowDays` finished days, oldest first, then today. */
  days: ReadinessDay[];
  /** Finished days in the window. */
  judgedDays: number;
  loggedDays: number;
  /** Average progress of the logged, finished days; null before there are any. */
  average: number | null;
  strongest: HabitStrength[];
  weakest: HabitStrength[];
  rules: ReadinessRules;
}

export interface ReadinessInput {
  phases: readonly Phase[];
  habits: readonly Habit[];
  targetsByHabit: ReadonlyMap<string, readonly HabitTarget[]>;
  logs: readonly HabitLog[];
  dayStatuses: readonly DayStatus[];
  /** Dates with at least one activity. */
  activityDates: ReadonlySet<IsoDate>;
  today: IsoDate;
  config: DayConfig;
  rules: ReadinessRules;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The phase being worked on: the highest-numbered active or paused phase. */
export function currentPhase(phases: readonly Phase[]): Phase | null {
  return (
    [...phases]
      .filter((p) => p.status === "active" || p.status === "paused")
      .sort((a, b) => b.number - a.number)[0] ?? null
  );
}

/** The next phase to enable: the lowest-numbered locked one. */
export function nextPhase(phases: readonly Phase[]): Phase | null {
  return (
    [...phases].filter((p) => p.status === "locked").sort((a, b) => a.number - b.number)[0] ?? null
  );
}

/** Where the phase's window starts: its latest start or repeat. */
export function cycleStartOf(phase: Phase, config: DayConfig, today: IsoDate): IsoDate {
  const marks = phase.history.filter((e) => e.kind === "started" || e.kind === "repeated");
  if (marks.length) return marks.reduce((a, b) => (b.date > a.date ? b : a)).date;
  return phase.startedAt ? logicalDate(new Date(phase.startedAt), config) : today;
}

/** Days any phase was paused (from "paused" until it was resumed, or until today). */
export function pausedDates(phases: readonly Phase[], today: IsoDate): Set<IsoDate> {
  const out = new Set<IsoDate>();
  for (const phase of phases) {
    const events = [...phase.history].sort((a, b) => a.date.localeCompare(b.date));
    let pausedFrom: IsoDate | null = null;
    for (const e of events) {
      if (e.kind === "paused") pausedFrom ??= e.date;
      else if (pausedFrom) {
        for (const d of eachDay(pausedFrom, addDays(e.date, -1))) out.add(d);
        pausedFrom = null;
      }
    }
    if (pausedFrom && phase.status === "paused") {
      for (const d of eachDay(pausedFrom, today)) out.add(d);
    }
  }
  return out;
}

export function phaseReadiness(input: ReadinessInput): PhaseReadiness {
  const { phases, today, config, rules } = input;
  const phase = currentPhase(phases);
  const next = nextPhase(phases);
  const empty: PhaseReadiness = {
    phase,
    next,
    state: "no-phase",
    cycleStart: null,
    dayNumber: 0,
    days: [],
    judgedDays: 0,
    loggedDays: 0,
    average: null,
    strongest: [],
    weakest: [],
    rules,
  };
  if (!phase) return empty;

  const cycleStart = cycleStartOf(phase, config, today);
  const paused = pausedDates(phases, today);
  const rest = new Set(input.dayStatuses.filter((d) => d.type !== "normal").map((d) => d.date));
  const eligible = (cycleStart <= today ? eachDay(cycleStart, today) : []).filter(
    (d) => !rest.has(d) && !paused.has(d),
  );
  // The judged window: the last `windowDays` finished days. Today is shown after it.
  const judged = eligible.filter((d) => d < today).slice(-rules.windowDays);
  const windowDates = eligible.includes(today) ? [...judged, today] : judged;

  // Habits on the checklist: not archived, in a phase that isn't locked.
  const unlocked = new Set(phases.filter((p) => p.status !== "locked").map((p) => p.id));
  const logsByHabit = new Map<string, Map<IsoDate, HabitLog>>();
  for (const log of input.logs) {
    if (!logsByHabit.has(log.habitId)) logsByHabit.set(log.habitId, new Map());
    logsByHabit.get(log.habitId)!.set(log.date, log);
  }
  const habits = input.habits
    .filter((h) => !h.archived && unlocked.has(h.phaseId))
    .map((habit) => {
      const logs = logsByHabit.get(habit.id) ?? new Map<IsoDate, HabitLog>();
      return {
        habit,
        targets: input.targetsByHabit.get(habit.id) ?? [],
        logs,
        start: habitStartDate(habit, logs.keys(), config),
      };
    });

  const strength = new Map<string, { sum: number; n: number }>();
  const days: ReadinessDay[] = windowDates.map((date) => {
    const summary = summarizeDay({
      date,
      dayStartHour: config.dayStartHour,
      habits: habits
        .filter((h) => h.start <= date)
        .map((h) => {
          const log = h.logs.get(date);
          return {
            habit: h.habit,
            targets: h.targets,
            entry: log ? { value: log.value, time: log.time } : null,
          };
        }),
    });
    if (date < today) {
      for (const item of summary.items) {
        if (!item.counted) continue;
        const s = strength.get(item.habitId) ?? { sum: 0, n: 0 };
        s.sum += item.score.progress;
        s.n += 1;
        strength.set(item.habitId, s);
      }
    }
    return {
      date,
      average: summary.averageProgress,
      logged: summary.hasAnyLog || input.activityDates.has(date),
      today: date === today,
    };
  });

  const loggedJudged = days.filter((d) => !d.today && d.logged && d.average !== null);
  const average = loggedJudged.length
    ? round1(loggedJudged.reduce((sum, d) => sum + d.average!, 0) / loggedJudged.length)
    : null;
  const loggedDays = days.filter((d) => !d.today && d.logged).length;

  const ranked = [...strength]
    .map(([habitId, s]) => ({ habitId, percent: round1(s.sum / s.n) }))
    .sort((a, b) => b.percent - a.percent);

  let state: ReadinessState;
  if (phase.status === "paused") state = "paused";
  else if (judged.length < rules.windowDays) state = "in-progress";
  else if (loggedDays < rules.minLoggedDays) state = "too-few-logged";
  else if (average === null || average < rules.threshold) state = "below-target";
  else state = "ready";

  return {
    ...empty,
    state,
    cycleStart,
    dayNumber: Math.min(eligible.length, rules.windowDays),
    days,
    judgedDays: judged.length,
    loggedDays,
    average,
    strongest: ranked.slice(0, 3),
    weakest: ranked.length > 3 ? ranked.slice(-3).reverse() : [],
  };
}
