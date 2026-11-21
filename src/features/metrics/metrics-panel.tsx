"use client";

import { Moon } from "lucide-react";
import { useId, useState } from "react";
import { Panel, type Span } from "@/components/dashboard";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import { isValidMetricNumber, METRIC_LIMITS, type MetricValue } from "@/data/metric-ops";
import type { Habit, Metric, MetricKey, Settings } from "@/data/schema";
import { formatDuration } from "@/features/activities/summary";
import { formatNumber } from "@/features/today/format";
import { useMetrics, useSetMetric } from "@/hooks/use-metrics";
import { addDays, sleepMinutes, type IsoDate } from "@/lib/core";
import { cn } from "@/lib/utils";

const t = copy.pages.today.metrics;

type NumberKey = keyof typeof METRIC_LIMITS;

/** The number boxes, in the order they appear. Sleep hours come from bed and wake time. */
const NUMBER_FIELDS: readonly NumberKey[] = [
  "steps",
  "water",
  "weight",
  "screen_time",
  "reels_minutes",
];

/** 1–5 scales, picked with a row of buttons. */
const SCALE_FIELDS = ["mood", "energy"] as const;

function unitFor(key: NumberKey, units: Settings["units"]): string {
  switch (key) {
    case "steps":
      return t.units.steps;
    case "water":
      return t.units.water;
    case "weight":
      return units === "imperial" ? t.units.lb : t.units.kg;
    case "screen_time":
    case "reels_minutes":
      return t.units.minutes;
    case "sleep_hours":
      return t.units.hours;
    case "mood":
    case "energy":
      return t.units.scale;
  }
}

/** "Your numbers" on Today: steps, water, weight, sleep, screen time, reels, mood, energy. */
export function MetricsPanel({
  date,
  habits,
  units,
  span = 4,
}: {
  date: IsoDate;
  /** Active habits, to show which ones a number counts for. */
  habits: readonly Habit[];
  units: Settings["units"];
  span?: Span;
}) {
  const metrics = useMetrics();
  const setMetric = useSetMetric();
  const [error, setError] = useState<string | null>(null);

  const find = (d: IsoDate, key: MetricKey): Metric | undefined =>
    metrics.data?.find((m) => m.date === d && m.key === key);
  const linkedName = (key: MetricKey) => habits.find((h) => h.metricKey === key)?.name;

  const save = (d: IsoDate, key: MetricKey, value: MetricValue) => {
    setError(null);
    setMetric.mutate(
      { date: d, key, value },
      { onError: (e) => setError(t.failed(e instanceof Error ? e.message : String(e))) },
    );
  };

  const commitNumber = (key: NumberKey, label: string, text: string) => {
    const trimmed = text.trim();
    const current = find(date, key)?.valueNum ?? null;
    if (trimmed === "") {
      if (current !== null) save(date, key, null);
      return;
    }
    const value = Number(trimmed);
    const limit = METRIC_LIMITS[key];
    if (!isValidMetricNumber(key, value)) {
      setError(
        limit.integer && Number.isFinite(value) && !Number.isInteger(value)
          ? t.wholeNumber(label)
          : t.invalid(label, formatNumber(limit.min), formatNumber(limit.max)),
      );
      return;
    }
    if (value !== current) save(date, key, value);
  };

  const commitTime = (d: IsoDate, key: "bed_time" | "wake_time", text: string) => {
    const current = find(d, key)?.valueTime ?? null;
    const value = text || null;
    if (value !== current) save(d, key, value);
  };

  const yesterday = addDays(date, -1);
  const bed = find(yesterday, "bed_time")?.valueTime ?? null;
  const wake = find(date, "wake_time")?.valueTime ?? null;
  const typedSleep = find(date, "sleep_hours")?.valueNum ?? null;
  const slept =
    bed && wake
      ? sleepMinutes(bed, wake)
      : typedSleep !== null
        ? Math.round(typedSleep * 60)
        : null;

  return (
    <Panel span={span} title={t.title} subtitle={t.subtitle}>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {metrics.isPending ? null : (
        <div className="grid gap-4">
          <fieldset className="rounded-xl border p-3">
            <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
              <Moon aria-hidden className="size-4 text-muted-foreground" />
              {t.sleepTitle}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <TimeField
                key={`bed-${yesterday}-${bed}`}
                label={t.bed}
                saved={bed}
                hint={linkedName("bed_time")}
                onCommit={(v) => commitTime(yesterday, "bed_time", v)}
              />
              <TimeField
                key={`wake-${date}-${wake}`}
                label={t.wake}
                saved={wake}
                hint={linkedName("wake_time")}
                onCommit={(v) => commitTime(date, "wake_time", v)}
              />
            </div>
            <p className="mt-2 text-sm" data-testid="sleep-result">
              {slept !== null ? (
                <span className="font-medium">{t.slept(formatDuration(slept))}</span>
              ) : (
                <span className="text-muted-foreground">{t.sleptMissing}</span>
              )}
            </p>
          </fieldset>

          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {NUMBER_FIELDS.map((key) => {
              const saved = find(date, key)?.valueNum ?? null;
              const label = t.labels[key as keyof typeof t.labels];
              return (
                <NumberField
                  key={`${key}-${date}-${saved}`}
                  label={label}
                  unit={unitFor(key, units)}
                  saved={saved}
                  limit={METRIC_LIMITS[key]}
                  hint={linkedName(key)}
                  onCommit={(text) => commitNumber(key, label, text)}
                />
              );
            })}
          </div>

          {SCALE_FIELDS.map((key) => {
            const saved = find(date, key)?.valueNum ?? null;
            return (
              <ScaleField
                key={key}
                label={t.labels[key]}
                ends={t.scaleEnds[key]}
                value={saved}
                onPick={(v) => save(date, key, v === saved ? null : v)}
              />
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/** 1 to 5 as buttons; tapping the chosen one again clears it. */
function ScaleField({
  label,
  ends,
  value,
  onPick,
}: {
  label: string;
  ends: { low: string; high: string };
  value: number | null;
  onPick: (value: number) => void;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id}>
      <p id={id} className="mb-1.5 text-sm font-medium">
        {label}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t.scaleOption(label, n)}
            onClick={() => onPick(n)}
            className={cn(
              "h-11 rounded-xl border text-base font-semibold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-primary",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div aria-hidden className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{ends.low}</span>
        <span>{ends.high}</span>
      </div>
    </div>
  );
}

/** Saves when you leave the box or press Enter. Remounted (via `key`) when the saved value changes. */
function NumberField({
  label,
  unit,
  saved,
  limit,
  hint,
  onCommit,
}: {
  label: string;
  unit: string;
  saved: number | null;
  limit: { min: number; max: number; step: number };
  hint?: string;
  onCommit: (text: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={limit.min}
          max={limit.max}
          step={limit.step}
          defaultValue={saved ?? ""}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onBlur={(e) => onCommit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit(e.currentTarget.value);
          }}
          className="tabular-nums"
        />
        <span className="w-9 shrink-0 text-xs text-muted-foreground">{unit}</span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {t.linked(hint)}
        </p>
      )}
    </div>
  );
}

function TimeField({
  label,
  saved,
  hint,
  onCommit,
}: {
  label: string;
  saved: string | null;
  hint?: string;
  onCommit: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="time"
        defaultValue={saved ?? ""}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit(e.currentTarget.value);
        }}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {t.linked(hint)}
        </p>
      )}
    </div>
  );
}
