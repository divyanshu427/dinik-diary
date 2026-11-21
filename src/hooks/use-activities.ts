"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDataStore } from "@/data";
import * as ops from "@/data/activity-ops";
import { queryKeys } from "./query-keys";
import { useSettings } from "./use-data";

/** Every activity (local data is small; later phases can narrow this to a date range). */
export function useActivities() {
  return useQuery({
    queryKey: queryKeys.activities,
    queryFn: () => getDataStore().activities.listRange("0000-01-01", "9999-12-31"),
  });
}

type Op<A extends unknown[], R> = (ctx: ops.ActivityContext, ...args: A) => Promise<R>;

function useOp<A extends unknown[], R>(op: Op<A, R>, getCtx: () => ops.ActivityContext) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => op(getCtx(), ...args),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

/** Changes to activities and categories. Call with an argument array, e.g. `remove.mutate([id])`. */
export function useActivityEditor() {
  const { data: settings } = useSettings();
  const getCtx = (): ops.ActivityContext => ({
    store: getDataStore(),
    dayStartHour: settings?.dayStartHour ?? 4,
  });
  return {
    create: useOp(ops.createActivity, getCtx),
    update: useOp(ops.updateActivity, getCtx),
    remove: useOp(ops.deleteActivity, getCtx),
    duplicate: useOp(ops.duplicateActivity, getCtx),
    repeatDay: useOp(ops.repeatDay, getCtx),
    fixOverlap: useOp(ops.fixOverlap, getCtx),
    createCategory: useOp(ops.createCategory, getCtx),
    updateCategory: useOp(ops.updateCategory, getCtx),
    archiveCategory: useOp(ops.setCategoryArchived, getCtx),
    deleteCategory: useOp(ops.deleteCategory, getCtx),
    mergeCategories: useOp(ops.mergeCategories, getCtx),
  };
}
