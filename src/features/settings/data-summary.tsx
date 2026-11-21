"use client";

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/copy";
import { useDataCounts, useHabits, usePhases, useStoragePersistence } from "@/hooks/use-data";

const t = copy.pages.data;
const SHOWN_TABLES = [
  "phases",
  "habits",
  "categories",
  "habitLogs",
  "activities",
  "metrics",
  "concerns",
] as const;

/** "Your data" panel: what's stored on this device, and the habits in each phase. */
export function DataSummary() {
  const counts = useDataCounts();
  const phases = usePhases();
  const habits = useHabits();
  const storage = useStoragePersistence();

  if (counts.isError || phases.isError || habits.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.loadError}
      </p>
    );
  }
  if (!counts.data || !phases.data || !habits.data) {
    return <p className="text-sm text-muted-foreground">{t.loading}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {SHOWN_TABLES.map((table) => (
          <div key={table} className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{t.tables[table]}</dt>
            <dd
              className="font-heading text-2xl font-semibold tabular-nums"
              data-testid={`count-${table}`}
            >
              {counts.data[table]}
            </dd>
          </div>
        ))}
      </dl>

      {storage.data && <p className="text-sm text-muted-foreground">{t.storage[storage.data]}</p>}

      <div>
        <h3 className="mb-2 text-sm font-semibold">{t.habitsByPhase}</h3>
        <ul className="flex flex-col divide-y rounded-xl border">
          {phases.data.map((phase) => {
            const list = habits.data.filter((h) => h.phaseId === phase.id && !h.archived);
            return (
              <li key={phase.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none focus-visible:bg-muted [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                    />
                    <span className="flex-1 text-sm font-medium">
                      {t.phaseLabel(phase.number, phase.name)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.habitCount(list.length)}
                    </span>
                    <Badge variant={phase.status === "active" ? "default" : "secondary"}>
                      {t.phaseStatus[phase.status]}
                    </Badge>
                  </summary>
                  <ul className="flex flex-col gap-1 px-11 pb-3 text-sm">
                    {list.map((h) => (
                      <li key={h.id} className="flex justify-between gap-3">
                        <span>{h.name}</span>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {t.habitTypes[h.type]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
