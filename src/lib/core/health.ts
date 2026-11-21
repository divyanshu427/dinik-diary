import type { Habit, HealthAdjustment, HealthKind, PartOfDay } from "@/data/schema";
import { addDays, type IsoDate } from "./day";
import { libraryRole, profileFor, type HabitRole, type IssueProfile } from "./health-library";
import type { TargetValues } from "./targets";

/*
 * The health advisor (Build Phase 12): the "plan for the next few days".
 *
 * I only say what's wrong and how bad it is. The advisor looks at every habit on my checklist,
 * my targets and my history, and suggests changes with the reasons:
 * - what usually makes this issue worse or better (health-library.ts),
 * - what my own data shows (e.g. pain was higher on days after Workout),
 * - what I said myself (optional "More details" on the issue).
 * Nothing changes until I approve. Not medical advice: at 8+ or when it keeps getting worse,
 * a doctor comes first and no new exercise is suggested.
 *
 * Stage 2: an AI advisor can produce the same `HealthSuggestion`s (with its own reasons).
 */

export const HEALTH_RULES = {
  /** Two check-ins in a row at this level or above → lighten what makes it worse. */
  high: 6,
  /** At this level, or worse three times in a row → see a doctor. */
  doctor: 8,
  /** Today at this level or above → suggest a Sick day. */
  sick: 7,
  /** Two check-ins in a row at this level or below → back to normal. */
  better: 3,
  /** From this level: raise what helps (e.g. water) and suggest a helpful habit. */
  helper: 3,
  /** How long a change lasts. */
  days: 5,
  /** A check-in older than this many days is too old to act on. */
  freshDays: 2,
  /** "Two in a row" means the two latest check-ins are at most this many days apart… */
  pairDays: 3,
  /** …and "three times in a row" fits within this many days. */
  trendDays: 7,
  /** History patterns need this many days on each side… */
  minDays: 3,
  /** …and this big a difference (points out of 10). */
  minGap: 1.5,
} as const;

export interface CheckInPoint {
  date: IsoDate;
  severity: number;
}

export interface HealthIssueInput {
  id: string;
  title: string;
  kind: HealthKind;
  status: "active" | "improving" | "resolved";
  helpsWith: string;
  /** Habits I said help (optional). */
  linkedHabitIds: readonly string[];
  /** Habits I said make it worse (optional). */
  strainHabitIds: readonly string[];
  adjustments: readonly HealthAdjustment[];
  dismissed: readonly string[];
  /** Any order. */
  checkIns: readonly CheckInPoint[];
}

/** A habit on the checklist, as the advisor sees it. */
export interface AdvisorHabit {
  id: string;
  name: string;
  key: string;
  type: Habit["type"];
  direction: Habit["direction"];
  /** The target today. */
  target: TargetValues | undefined;
  /** Days it was fully done. */
  doneDates: ReadonlySet<IsoDate>;
  /** Days it was due (for "you managed it 0 of the last 3 days"). */
  dueDates: ReadonlySet<IsoDate>;
}

export type Reason =
  /** What usually holds for this kind of issue (library). */
  | { source: "usual"; profile: string; role: HabitRole }
  /** I said so on the issue. */
  | { source: "you"; role: "strain" | "helps" }
  /** My check-ins were higher on days after doing it. */
  | { source: "after"; withHabit: number; without: number }
  /** My check-ins were lower on days I did it. */
  | { source: "lower"; withHabit: number; without: number }
  /** How it went lately. */
  | { source: "recent"; done: number; of: number };

export type HabitChange =
  /** Easier: a lower target (e.g. 30 → 15 min). */
  | { mode: "lower"; values: TargetValues }
  /** Stricter "at most" limit (e.g. screen time 180 → 120 min). */
  | { mode: "tighten"; values: TargetValues }
  /** A little more of something that helps (e.g. water 3 → 3.5 L). */
  | { mode: "raise"; values: TargetValues }
  | { mode: "pause" };

export type HealthSuggestion =
  | {
      kind: "see-doctor";
      key: string;
      issueId: string;
      reason: "high" | "worsening";
      latest: number;
    }
  | {
      kind: "change";
      key: string;
      issueId: string;
      habitId: string;
      change: HabitChange;
      days: number;
      reasons: Reason[];
    }
  | {
      kind: "add-helper";
      key: string;
      issueId: string;
      /** A library profile id (its name comes from the copy file), or null for "what helps". */
      profile: string | null;
      name: string | null;
      habit: {
        type: "duration" | "boolean" | "count";
        target: number | null;
        unit: string;
        partOfDay: PartOfDay;
      };
    }
  | { kind: "sick-day"; key: string; issueId: string }
  | { kind: "back-to-normal"; key: string; issueId: string; adjustmentIds: string[] };

/** A plan change that's still running on `today`. */
export const isActiveAdjustment = (a: HealthAdjustment, today: IsoDate) =>
  a.endedOn === null && a.from <= today && today <= a.to;

/** The first thing in "what helps", e.g. "stretching, warm shower" → "Stretching". */
export function firstHelper(helpsWith: string): string | null {
  const first = helpsWith
    .split(/[,;\n]| and /)
    .map((s) => s.trim())
    .find(Boolean);
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : null;
}

// ---------- target changes ----------

/** Rounds to steps that feel natural: 2,600 steps, 15 min, 3.5 L. */
function niceRound(value: number, type: Habit["type"]): number {
  if (type === "duration") return Math.max(5, Math.round(value / 5) * 5);
  if (type === "count") return Math.max(1, Math.round(value));
  if (value >= 1000) return Math.round(value / 100) * 100;
  if (value >= 20) return Math.round(value / 5) * 5;
  return Math.max(0.5, Math.round(value * 2) / 2);
}

const values = (targetValue: number): TargetValues => ({
  targetValue,
  targetTime: null,
  graceMinutes: 0,
});

/** How a habit changes while an issue is bad: lighter, a tighter limit, a little more, or paused. */
export function planChange(
  habit: Pick<AdvisorHabit, "type" | "direction" | "target">,
  role: "strain" | "raise",
): HabitChange | null {
  const value = habit.target?.targetValue ?? null;
  const measured = habit.type !== "boolean" && habit.type !== "time" && value !== null && value > 0;
  if (role === "raise") {
    if (!measured || habit.direction !== "higher_better") return null;
    const raised = niceRound(value * 1.15, habit.type);
    return raised > value ? { mode: "raise", values: values(raised) } : null;
  }
  if (!measured) return { mode: "pause" };
  if (habit.direction === "lower_better") {
    const tighter = niceRound(value * 0.67, habit.type);
    return tighter < value ? { mode: "tighten", values: values(tighter) } : null;
  }
  return { mode: "lower", values: values(niceRound(value / 2, habit.type)) };
}

// ---------- patterns in my history ----------

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * "4 on days you did Stretching, 6.5 on other days": check-ins on days a habit was done against
 * days it wasn't. Only when it's clearly lower (3+ days each, 1.5 points or more).
 */
export function habitEffect(
  checkIns: readonly CheckInPoint[],
  doneDates: ReadonlySet<IsoDate>,
): { withHabit: number; without: number } | null {
  const withHabit = checkIns.filter((c) => doneDates.has(c.date)).map((c) => c.severity);
  const without = checkIns.filter((c) => !doneDates.has(c.date)).map((c) => c.severity);
  if (withHabit.length < HEALTH_RULES.minDays || without.length < HEALTH_RULES.minDays) return null;
  const a = round1(avg(withHabit));
  const b = round1(avg(without));
  return b - a >= HEALTH_RULES.minGap ? { withHabit: a, without: b } : null;
}

/**
 * "7 on days after Workout, 4 after days without": check-ins the day after doing a habit.
 * Only when it's clearly higher (3+ days each, 1.5 points or more).
 */
export function afterEffect(
  checkIns: readonly CheckInPoint[],
  doneDates: ReadonlySet<IsoDate>,
): { withHabit: number; without: number } | null {
  const after = checkIns.filter((c) => doneDates.has(addDays(c.date, -1))).map((c) => c.severity);
  const other = checkIns.filter((c) => !doneDates.has(addDays(c.date, -1))).map((c) => c.severity);
  if (after.length < HEALTH_RULES.minDays || other.length < HEALTH_RULES.minDays) return null;
  const a = round1(avg(after));
  const b = round1(avg(other));
  return a - b >= HEALTH_RULES.minGap ? { withHabit: a, without: b } : null;
}

/** Average of the last 7 days against the 7 before ("down from 6 to 4 this week"). */
export function healthTrend(
  checkIns: readonly CheckInPoint[],
  today: IsoDate,
): { recent: number | null; before: number | null } {
  const recentFrom = addDays(today, -6);
  const beforeFrom = addDays(today, -13);
  const recent = checkIns
    .filter((c) => c.date >= recentFrom && c.date <= today)
    .map((c) => c.severity);
  const before = checkIns
    .filter((c) => c.date >= beforeFrom && c.date < recentFrom)
    .map((c) => c.severity);
  return {
    recent: recent.length ? round1(avg(recent)) : null,
    before: before.length ? round1(avg(before)) : null,
  };
}

// ---------- roles ----------

export interface HabitRoleInfo {
  role: HabitRole;
  reasons: Reason[];
}

/**
 * Every checklist habit that matters for an issue, with why. My own word wins, then my history,
 * then what usually holds.
 */
export function habitRoles(
  issue: HealthIssueInput,
  habits: readonly AdvisorHabit[],
): Map<string, HabitRoleInfo> {
  const profile: IssueProfile | null = profileFor(issue.title);
  const points = issue.checkIns;
  const out = new Map<string, HabitRoleInfo>();
  for (const habit of habits) {
    if (issue.strainHabitIds.includes(habit.id)) {
      out.set(habit.id, { role: "strain", reasons: [{ source: "you", role: "strain" }] });
      continue;
    }
    if (issue.linkedHabitIds.includes(habit.id)) {
      const lower = habitEffect(points, habit.doneDates);
      out.set(habit.id, {
        role: "helps",
        reasons: [
          { source: "you", role: "helps" },
          ...(lower ? [{ source: "lower" as const, ...lower }] : []),
        ],
      });
      continue;
    }
    // Done every other day, both patterns can show up from the same data: then it's unclear,
    // and only what usually holds is used.
    const afterRaw = afterEffect(points, habit.doneDates);
    const lowerRaw = habitEffect(points, habit.doneDates);
    const after = afterRaw && !lowerRaw ? afterRaw : null;
    const lower = lowerRaw && !afterRaw ? lowerRaw : null;
    const usual = profile ? libraryRole(profile, habit) : null;
    if (after) {
      out.set(habit.id, {
        role: "strain",
        reasons: [
          { source: "after", ...after },
          ...(usual === "strain"
            ? [{ source: "usual" as const, profile: profile!.id, role: usual }]
            : []),
        ],
      });
    } else if (lower) {
      out.set(habit.id, {
        role: usual === "raise" ? "raise" : "helps",
        reasons: [{ source: "lower", ...lower }],
      });
    } else if (usual) {
      out.set(habit.id, {
        role: usual,
        reasons: [{ source: "usual", profile: profile!.id, role: usual }],
      });
    }
  }
  return out;
}

// ---------- suggestions ----------

export interface AdviceInput {
  issues: readonly HealthIssueInput[];
  /** Habits on the checklist. */
  habits: readonly AdvisorHabit[];
  today: IsoDate;
  todayIsSick: boolean;
}

/** The suggestions to show (ones I said "OK" or "Not now" to are left out). */
export function adviseHealth(params: AdviceInput): HealthSuggestion[] {
  return adviseHealthAll(params).shown;
}

/**
 * Everything the advisor would suggest, split into what to show and what I already answered
 * for this check-in (kept so the screen can list them as "hidden until your next check-in").
 */
export function adviseHealthAll(params: AdviceInput): {
  shown: HealthSuggestion[];
  hidden: HealthSuggestion[];
} {
  const { today, habits } = params;
  const r = HEALTH_RULES;
  const doctor: HealthSuggestion[] = [];
  const other: HealthSuggestion[] = [];
  const changing = new Set<string>(); // one change per habit, even if two issues ask for it
  const hiddenKeys = new Set<string>();
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const adjusted = (habitId: string) =>
    params.issues.some((i) =>
      i.adjustments.some((a) => a.habitId === habitId && isActiveAdjustment(a, today)),
    );

  for (const issue of params.issues) {
    if (issue.status === "resolved") continue;
    const profile = profileFor(issue.title);
    const points = [...issue.checkIns]
      .filter((c) => c.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = points.at(-1);
    const fresh = latest && latest.date >= addDays(today, -(r.freshDays - 1));
    // "In a row" only counts when the check-ins are close together (not a week apart).
    const pair = points.slice(-2);
    const lastTwo =
      pair.length === 2 && pair[0].date >= addDays(pair[1].date, -r.pairDays) ? pair : [];
    const triple = points.slice(-3);
    const lastThree =
      triple.length === 3 && triple[0].date >= addDays(triple[2].date, -r.trendDays) ? triple : [];
    const add = (list: HealthSuggestion[], s: HealthSuggestion) => {
      if (issue.dismissed.includes(s.key)) hiddenKeys.add(s.key);
      list.push(s);
    };
    const active = issue.adjustments.filter((a) => isActiveAdjustment(a, today));

    // Feeling better: end the changes early.
    if (active.length && lastTwo.length === 2 && lastTwo.every((p) => p.severity <= r.better)) {
      add(other, {
        kind: "back-to-normal",
        key: `back-to-normal:${issue.id}:${latest!.date}`,
        issueId: issue.id,
        adjustmentIds: active.map((a) => a.id),
      });
    }
    if (!latest || !fresh) continue;

    const worsening =
      lastThree.length === 3 &&
      lastThree[0].severity < lastThree[1].severity &&
      lastThree[1].severity < lastThree[2].severity &&
      latest.severity >= 5;
    const seeDoctor = latest.severity >= r.doctor || worsening;
    if (seeDoctor) {
      add(doctor, {
        kind: "see-doctor",
        key: `see-doctor:${issue.id}:${latest.date}`,
        issueId: issue.id,
        reason: latest.severity >= r.doctor ? "high" : "worsening",
        latest: latest.severity,
      });
    }

    const roles = habitRoles({ ...issue, checkIns: points }, habits);
    const actAt = profile?.actAt ?? r.high;
    const bad = lastTwo.length === 2 && lastTwo.every((p) => p.severity >= actAt);
    const changeRoutine = issue.kind !== "concern"; // hair or skin: add what helps, don't cut back

    for (const [habitId, info] of roles) {
      const habit = habitById.get(habitId)!;
      if (adjusted(habitId) || changing.has(habitId)) continue;
      let change: HabitChange | null = null;
      if (info.role === "strain" && bad && changeRoutine) change = planChange(habit, "strain");
      if (info.role === "raise" && latest.severity >= r.helper && !seeDoctor)
        change = planChange(habit, "raise");
      if (!change) continue;

      // How it went the last 3 days it was due, e.g. "you managed it 0 of the last 3 days".
      const due = [...habit.dueDates]
        .filter((d) => d < today)
        .sort()
        .slice(-3);
      const reasons: Reason[] = [...info.reasons];
      if (info.role === "strain" && due.length === 3) {
        reasons.push({
          source: "recent",
          done: due.filter((d) => habit.doneDates.has(d)).length,
          of: 3,
        });
      }
      changing.add(habitId);
      add(other, {
        kind: "change",
        key: `change:${issue.id}:${habitId}:${latest.date}`,
        issueId: issue.id,
        habitId,
        change,
        days: r.days,
        reasons,
      });
    }

    // Something that helps, when nothing helpful is on the checklist (never when it's serious).
    const helping = [...roles.values()].some((x) => x.role === "helps" || x.role === "raise");
    const named = firstHelper(issue.helpsWith);
    if (!seeDoctor && !helping && latest.severity >= r.helper && (profile?.helper || named)) {
      add(other, {
        kind: "add-helper",
        key: `add-helper:${issue.id}:${latest.date}`,
        issueId: issue.id,
        profile: named ? null : profile!.id,
        name: named,
        habit: profile?.helper ?? { type: "duration", target: 10, unit: "", partOfDay: "anytime" },
      });
    }

    if (
      changeRoutine &&
      latest.date === today &&
      latest.severity >= r.sick &&
      !params.todayIsSick
    ) {
      add(other, { kind: "sick-day", key: `sick-day:${issue.id}:${today}`, issueId: issue.id });
    }
  }
  // Only one "mark today as sick", whichever issue asked.
  let sick = false;
  const unique = other.filter((s) => s.kind !== "sick-day" || (!sick && (sick = true)));
  const all = [...doctor, ...unique];
  return {
    shown: all.filter((s) => !hiddenKeys.has(s.key)),
    hidden: all.filter((s) => hiddenKeys.has(s.key)),
  };
}
