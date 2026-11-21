"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDataStore } from "@/data";
import { setMetric, TIME_METRICS, type MetricValue } from "@/data/metric-ops";
import type { Metric, MetricKey } from "@/data/schema";
import type { IsoDate } from "@/lib/core";
import { queryKeys } from "./query-keys";
import { useSettings } from "./use-data";

/** Every daily number (local data is small; later phases can narrow this to a date range). */
export function useMetrics() {
  return useQuery({
    queryKey: queryKeys.metrics,
    queryFn: () => getDataStore().metrics.listRange("0000-01-01", "9999-12-31"),
  });
}

/** Save or clear one number for a day. Shows instantly; linked habits and sleep follow the save. */
export function useSetMetric() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  return useMutation({
    mutationFn: ({ date, key, value }: { date: IsoDate; key: MetricKey; value: MetricValue }) =>
      setMetric(
        { store: getDataStore(), dayStartHour: settings?.dayStartHour ?? 4 },
        date,
        key,
        value,
      ),
    onMutate: async ({ date, key, value }) => {
      await qc.cancelQueries({ queryKey: queryKeys.metrics });
      const previous = qc.getQueryData<Metric[]>(queryKeys.metrics);
      qc.setQueryData<Metric[]>(queryKeys.metrics, (old = []) => {
        const others = old.filter((m) => !(m.date === date && m.key === key));
        if (value === null || value === "") return others;
        const existing = old.find((m) => m.date === date && m.key === key);
        const now = new Date().toISOString();
        const isTime = TIME_METRICS.has(key);
        return [
          ...others,
          {
            id: existing?.id ?? `pending-${date}-${key}`,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            date,
            key,
            valueNum: isTime ? null : (value as number),
            valueTime: isTime ? (value as string) : null,
          },
        ];
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.metrics, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.all }),
  });
}
