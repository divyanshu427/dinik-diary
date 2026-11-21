"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDataStore } from "@/data";
import type { BackupFile } from "@/data/backup";
import type { SettingsRepo } from "@/data/repositories";
import { queryKeys } from "./query-keys";

/*
 * Base hooks: screens read and change data through these, never through the database directly.
 * More hooks (day logs, activities, reports) arrive with their build phases.
 */

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => getDataStore().settings.get() });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<SettingsRepo["update"]>[0]) =>
      getDataStore().settings.update(patch),
    onSuccess: (settings) => qc.setQueryData(queryKeys.settings, settings),
  });
}

export function usePhases() {
  return useQuery({
    queryKey: queryKeys.phases,
    queryFn: async () => (await getDataStore().phases.list()).sort((a, b) => a.number - b.number),
  });
}

export function useHabits() {
  return useQuery({
    queryKey: queryKeys.habits,
    queryFn: async () =>
      (await getDataStore().habits.list()).sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

export function useHabitTargets() {
  return useQuery({
    queryKey: queryKeys.habitTargets,
    queryFn: () => getDataStore().habitTargets.list(),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () =>
      (await getDataStore().categories.list()).sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

/** Every habit check-in (local data is small; later phases can narrow this to a date range). */
export function useHabitLogs() {
  return useQuery({
    queryKey: queryKeys.habitLogs,
    queryFn: () => getDataStore().habitLogs.listRange("0000-01-01", "9999-12-31"),
  });
}

/** Every rest / sick / travel day. */
export function useDayStatuses() {
  return useQuery({
    queryKey: queryKeys.dayStatus,
    queryFn: () => getDataStore().dayStatus.listRange("0000-01-01", "9999-12-31"),
  });
}

export function useDataCounts() {
  return useQuery({ queryKey: queryKeys.counts, queryFn: () => getDataStore().counts() });
}

/** Exports everything as a backup file object. */
export function useExportBackup() {
  return useMutation({ mutationFn: () => getDataStore().exportAll() });
}

/** Replaces all data with a (validated) backup, then refreshes every screen. */
export function useImportBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: BackupFile) => getDataStore().importAll(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

/** Deletes all data and loads the starter data again. */
export function useResetData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getDataStore().resetToDefaults(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

/**
 * Whether the browser promised to keep our data (it can otherwise clear it when disk is low).
 * Asking is harmless; browsers decide on their own.
 */
export function useStoragePersistence() {
  return useQuery({
    queryKey: queryKeys.storage,
    queryFn: async () => {
      if (!navigator.storage?.persist) return "unsupported" as const;
      if (await navigator.storage.persisted()) return "persistent" as const;
      return (await navigator.storage.persist())
        ? ("persistent" as const)
        : ("best-effort" as const);
    },
    staleTime: Infinity,
  });
}
