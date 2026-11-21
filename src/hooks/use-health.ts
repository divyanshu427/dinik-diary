"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDataStore } from "@/data";
import type { OpsContext } from "@/data/habit-ops";
import * as ops from "@/data/health-ops";
import { queryKeys } from "./query-keys";
import { useSettings } from "./use-data";
import { useToday } from "./use-today";

/** Every health issue (newest first). */
export function useHealthIssues() {
  return useQuery({
    queryKey: queryKeys.concerns,
    queryFn: async () =>
      (await getDataStore().concerns.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

/** Every check-in, oldest first. */
export function useCheckIns() {
  return useQuery({
    queryKey: queryKeys.concernUpdates,
    queryFn: async () =>
      (await getDataStore().concernUpdates.list()).sort((a, b) => a.date.localeCompare(b.date)),
  });
}

type Op<A extends unknown[], R> = (ctx: OpsContext, ...args: A) => Promise<R>;

function useOp<A extends unknown[], R>(op: Op<A, R>, getCtx: () => OpsContext) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => op(getCtx(), ...args),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

/** Changes to health data. Call with an argument array, e.g. `checkIn.mutate([id, date, 6])`. */
export function useHealthEditor() {
  const today = useToday();
  const { data: settings } = useSettings();
  const getCtx = (): OpsContext => {
    if (!today || !settings) throw new Error("Still loading settings");
    return { store: getDataStore(), today, dayStartHour: settings.dayStartHour };
  };
  return {
    ready: today !== null && settings !== undefined,
    createIssue: useOp(ops.createHealthIssue, getCtx),
    updateIssue: useOp(ops.updateHealthIssue, getCtx),
    setStatus: useOp(ops.setHealthStatus, getCtx),
    deleteIssue: useOp(ops.deleteHealthIssue, getCtx),
    checkIn: useOp(ops.checkIn, getCtx),
    deleteCheckIn: useOp(ops.deleteCheckIn, getCtx),
    setDayNote: useOp(ops.setDayNote, getCtx),
    markSickDay: useOp(ops.markSickDay, getCtx),
    dismiss: useOp(ops.dismissSuggestion, getCtx),
    undismiss: useOp(ops.undismissSuggestion, getCtx),
    applyChange: useOp(ops.applyChange, getCtx),
    endAdjustment: useOp(ops.endAdjustment, getCtx),
    linkHelpingHabit: useOp(ops.linkHelpingHabit, getCtx),
  };
}

export type HealthEditor = ReturnType<typeof useHealthEditor>;
