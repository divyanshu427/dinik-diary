"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDataStore } from "@/data";
import * as ops from "@/data/habit-ops";
import * as phaseOps from "@/data/phase-ops";
import { queryKeys } from "./query-keys";
import { useSettings } from "./use-data";
import { useToday } from "./use-today";

type Op<A extends unknown[], R> = (ctx: ops.OpsContext, ...args: A) => Promise<R>;

/**
 * One editing operation as a mutation. Refreshes every data query afterwards, also on failure,
 * so an optimistic change on screen (e.g. after a drag) snaps back if saving failed.
 */
function useOp<A extends unknown[], R>(op: Op<A, R>, getCtx: () => ops.OpsContext) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => op(getCtx(), ...args),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

/** Mutations for the Habits screen. Call them with an argument array, e.g. `deleteHabit.mutate([id])`. */
export function useHabitEditor() {
  const today = useToday();
  const { data: settings } = useSettings();
  const ready = today !== null && settings !== undefined;

  const getCtx = (): ops.OpsContext => {
    if (!today || !settings) throw new Error("Still loading settings");
    return { store: getDataStore(), today, dayStartHour: settings.dayStartHour };
  };

  return {
    ready,
    today,
    createHabit: useOp(ops.createHabit, getCtx),
    updateHabit: useOp(ops.updateHabit, getCtx),
    moveHabit: useOp(ops.moveHabit, getCtx),
    placeHabit: useOp(ops.placeHabit, getCtx),
    reorderHabit: useOp(ops.reorderHabit, getCtx),
    setArchived: useOp(ops.setHabitArchived, getCtx),
    deleteHabit: useOp(ops.deleteHabit, getCtx),
    createPhase: useOp(ops.createPhase, getCtx),
    updatePhase: useOp(ops.updatePhase, getCtx),
    reorderPhase: useOp(ops.reorderPhase, getCtx),
    deletePhase: useOp(ops.deletePhase, getCtx),
    enablePhase: useOp(phaseOps.enablePhase, getCtx),
    repeatPhase: useOp(phaseOps.repeatPhase, getCtx),
    pausePhase: useOp(phaseOps.pausePhase, getCtx),
    resumePhase: useOp(phaseOps.resumePhase, getCtx),
    lockPhase: useOp(phaseOps.lockPhase, getCtx),
    setTargetUpgrades: useOp(phaseOps.setTargetUpgrades, getCtx),
  };
}

export type HabitEditor = ReturnType<typeof useHabitEditor>;

/** How many check-ins a habit has (locks its measurement type when > 0). */
export function useHabitLogCount(habitId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.all, "habitLogCount", habitId],
    queryFn: () => getDataStore().habitLogs.countForHabit(habitId!),
    enabled: habitId !== null,
  });
}
