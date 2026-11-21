"use client";

import { useMemo } from "react";
import { isUnlocked } from "@/data/habit-ops";
import type { Concern, ConcernUpdate, HabitTarget } from "@/data/schema";
import {
  useDayStatuses,
  useHabitLogs,
  useHabits,
  useHabitTargets,
  usePhases,
} from "@/hooks/use-data";
import { useCheckIns, useHealthIssues } from "@/hooks/use-health";
import { useToday } from "@/hooks/use-today";
import {
  addDays,
  adviseHealthAll,
  currentPhase,
  dueRoleOn,
  eachDay,
  habitRoles,
  targetOn,
  type AdvisorHabit,
} from "@/lib/core";

/**
 * Everything the Health screen and the Today check-in need: issues, check-ins per issue,
 * which habits are on the checklist, and the plan's suggestions.
 */
export function useHealthModel() {
  const issues = useHealthIssues();
  const checkIns = useCheckIns();
  const habits = useHabits();
  const targets = useHabitTargets();
  const phases = usePhases();
  const logs = useHabitLogs();
  const dayStatuses = useDayStatuses();
  const today = useToday();

  const isError = [issues, checkIns, habits, phases].some((q) => q.isError);

  const model = useMemo(() => {
    if (
      !issues.data ||
      !checkIns.data ||
      !habits.data ||
      !targets.data ||
      !phases.data ||
      !logs.data ||
      !dayStatuses.data ||
      !today
    )
      return null;

    const byIssue = new Map<string, ConcernUpdate[]>();
    for (const c of checkIns.data)
      byIssue.set(c.concernId, [...(byIssue.get(c.concernId) ?? []), c]);

    const unlocked = new Set(phases.data.filter(isUnlocked).map((p) => p.id));
    const checklist = habits.data.filter((h) => !h.archived && unlocked.has(h.phaseId));
    const onChecklist = new Set(checklist.map((h) => h.id));
    const targetsByHabit = new Map<string, HabitTarget[]>();
    for (const t of targets.data)
      targetsByHabit.set(t.habitId, [...(targetsByHabit.get(t.habitId) ?? []), t]);

    const doneDates = new Map<string, Set<string>>();
    for (const l of logs.data) {
      if (!l.done) continue;
      if (!doneDates.has(l.habitId)) doneDates.set(l.habitId, new Set());
      doneDates.get(l.habitId)!.add(l.date);
    }

    const todayStatus = dayStatuses.data.find((d) => d.date === today);
    const active = issues.data.filter((i) => i.status !== "resolved");

    // Every checklist habit, with today's target and when it was due and done (last 4 weeks).
    const recentDays = eachDay(addDays(today, -28), today);
    const advisorHabits: AdvisorHabit[] = checklist.map((h) => ({
      id: h.id,
      name: h.name,
      key: h.key,
      type: h.type,
      direction: h.direction,
      target: targetOn(targetsByHabit.get(h.id) ?? [], today),
      doneDates: doneDates.get(h.id) ?? new Set(),
      dueDates: new Set(recentDays.filter((d) => dueRoleOn(h, d) === "due")),
    }));
    const issueInput = (i: Concern) => ({
      ...i,
      checkIns: (byIssue.get(i.id) ?? []).map((c) => ({ date: c.date, severity: c.severity })),
    });
    const { shown: suggestions, hidden } = adviseHealthAll({
      issues: active.map(issueInput),
      habits: advisorHabits,
      today,
      todayIsSick: todayStatus?.type === "sick",
    });

    return {
      today,
      issues: issues.data,
      active,
      resolved: issues.data.filter((i) => i.status === "resolved"),
      checkInsFor: (id: string) => byIssue.get(id) ?? [],
      checklist,
      onChecklist,
      habitById: new Map(habits.data.map((h) => [h.id, h])),
      targetsByHabit,
      doneDates,
      dayNotes: dayStatuses.data.filter((d) => d.note.trim() !== ""),
      dayStatus: (date: string) => dayStatuses.data!.find((d) => d.date === date),
      currentPhaseId: currentPhase(phases.data)?.id ?? checklist[0]?.phaseId ?? phases.data[0]?.id,
      phases: phases.data,
      suggestions,
      /** Suggestions I already answered for the latest check-in. */
      hidden,
      advisorHabits,
      /** Which checklist habits matter for an issue, and why. */
      rolesFor: (issue: Concern) => habitRoles(issueInput(issue), advisorHabits),
    };
  }, [
    issues.data,
    checkIns.data,
    habits.data,
    targets.data,
    phases.data,
    logs.data,
    dayStatuses.data,
    today,
  ]);

  return { model, isError };
}

export type HealthModel = NonNullable<ReturnType<typeof useHealthModel>["model"]>;
