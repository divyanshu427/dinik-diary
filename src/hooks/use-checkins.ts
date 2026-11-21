"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getDataStore } from "@/data";
import { scoreCheckIn, setCheckIn, setCheckInNote, type CheckInRequest } from "@/data/checkin-ops";
import type { DayStatus, HabitLog } from "@/data/schema";
import type { IsoDate } from "@/lib/core";
import { queryKeys } from "./query-keys";
import { useSettings } from "./use-data";

/**
 * Tick / log a habit. The screen updates instantly (optimistic update); the save runs in the
 * background and, if it fails, the screen goes back to what's really saved.
 */
export function useCheckIn() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const dayStartHour = settings?.dayStartHour ?? 4;

  return useMutation({
    mutationFn: (req: CheckInRequest) => setCheckIn({ store: getDataStore(), dayStartHour }, req),
    onMutate: async (req) => {
      await qc.cancelQueries({ queryKey: queryKeys.habitLogs });
      const previous = qc.getQueryData<HabitLog[]>(queryKeys.habitLogs);
      qc.setQueryData<HabitLog[]>(queryKeys.habitLogs, (old = []) => {
        const others = old.filter((l) => !(l.habitId === req.habit.id && l.date === req.date));
        if (!req.entry || (req.entry.value === null && req.entry.time === null)) return others;
        const existing = old.find((l) => l.habitId === req.habit.id && l.date === req.date);
        const now = new Date().toISOString();
        const optimistic: HabitLog = {
          id: existing?.id ?? `pending-${req.habit.id}-${req.date}`,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          habitId: req.habit.id,
          date: req.date,
          value: req.entry.value,
          time: req.entry.time,
          ...scoreCheckIn(req, dayStartHour),
          note: req.note ?? existing?.note ?? "",
          source: "web",
          rawMessageId: null,
        };
        return [...others, optimistic];
      });
      return { previous };
    },
    onError: (_err, _req, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.habitLogs, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

export function useCheckInNote() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  return useMutation({
    mutationFn: ({ habitId, date, note }: { habitId: string; date: IsoDate; note: string }) =>
      setCheckInNote(
        { store: getDataStore(), dayStartHour: settings?.dayStartHour ?? 4 },
        habitId,
        date,
        note,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

/** Mark a day Normal / Rest / Sick / Travel. */
export function useSetDayStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      date,
      type,
      note = "",
    }: {
      date: IsoDate;
      type: DayStatus["type"];
      note?: string;
    }) => getDataStore().dayStatus.set(date, { type, note }),
    onMutate: async ({ date, type, note = "" }) => {
      await qc.cancelQueries({ queryKey: queryKeys.dayStatus });
      const previous = qc.getQueryData<DayStatus[]>(queryKeys.dayStatus);
      qc.setQueryData<DayStatus[]>(queryKeys.dayStatus, (old = []) => [
        ...old.filter((d) => d.date !== date),
        { date, type, note, updatedAt: new Date().toISOString() },
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.dayStatus, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.all }),
  });
}
