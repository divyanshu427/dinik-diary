"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDataStore } from "@/data";
import type { OpsContext } from "@/data/habit-ops";
import * as ops from "@/data/report-ops";
import { queryKeys } from "./query-keys";
import { useSettings } from "./use-data";
import { useToday } from "./use-today";

/** Every report, newest first. */
export function useHealthReports() {
  return useQuery({
    queryKey: queryKeys.healthReports,
    queryFn: async () =>
      (await getDataStore().healthReports.list()).sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      ),
  });
}

/** Every report file (with its data). */
export function useReportFiles() {
  return useQuery({
    queryKey: queryKeys.reportFiles,
    queryFn: () => getDataStore().reportFiles.list(),
  });
}

/** Every value, from reports and measured at home. */
export function useLabValues() {
  return useQuery({
    queryKey: queryKeys.labValues,
    queryFn: () => getDataStore().labValues.list(),
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

/** Changes to reports and values. Call with an argument array, e.g. `deleteReport.mutate([id])`. */
export function useReportEditor() {
  const today = useToday();
  const { data: settings } = useSettings();
  const getCtx = (): OpsContext => {
    if (!today || !settings) throw new Error("Still loading settings");
    return { store: getDataStore(), today, dayStartHour: settings.dayStartHour };
  };
  return {
    saveReport: useOp(ops.saveReport, getCtx),
    deleteReport: useOp(ops.deleteReport, getCtx),
    saveValue: useOp(ops.saveLabValue, getCtx),
    deleteValue: useOp(ops.deleteLabValue, getCtx),
  };
}
