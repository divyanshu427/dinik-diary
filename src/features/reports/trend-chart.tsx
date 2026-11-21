"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { copy } from "@/copy";
import { parseIsoDate, type IsoDate } from "@/lib/core";
import { cn } from "@/lib/utils";
import { tokenVar } from "@/theme/tokens";

const t = copy.pages.reports.trends;

export interface TrendSeries {
  key: string;
  label: string;
  points: { date: IsoDate; value: number | null }[];
  /** "7 h 30 min", "6,200 steps", "72%" */
  format: (value: number) => string;
  /** Short axis labels, e.g. "7h", "6k". */
  formatAxis?: (value: number) => string;
  /** Fixed axis range (e.g. 0–100 for percentages); otherwise round numbers around the data. */
  domain?: [number, number];
  /** Fixed axis ticks, e.g. 0 / 25 / 50 / 75 / 100. */
  ticks?: number[];
  /** A shaded "normal range" (e.g. from a lab report); either end may be open. */
  band?: { low: number | null; high: number | null };
  target: number | null;
  average: number | null;
}

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const asDate = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return new Date(year, month - 1, day);
};

/**
 * One measure at a time over the period (one axis, one line): pick it with the chips above.
 * The dashed line is the habit's target, when there is one.
 */
export function TrendChart({ series }: { series: readonly TrendSeries[] }) {
  const usable = series.filter((s) => s.points.filter((p) => p.value !== null).length >= 2);
  const [picked, setPicked] = useState<string | null>(null);
  const current = usable.find((s) => s.key === picked) ?? usable[0];

  if (!current) return <p className="text-sm text-muted-foreground">{t.empty}</p>;

  const many = current.points.length > 20;
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t.pick} className="flex flex-wrap gap-1.5">
        {usable.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={s.key === current.key}
            onClick={() => setPicked(s.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              s.key === current.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {current.average !== null && (
          <span className="font-medium text-foreground">
            {t.average(current.format(current.average))}
          </span>
        )}
        {current.target !== null && <span> · {t.target(current.format(current.target))}</span>}
      </p>

      <div
        className="h-56 w-full"
        role="img"
        aria-label={`${current.label}: ${t.average(current.average !== null ? current.format(current.average) : "—")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={current.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={tokenVar("border")} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => shortDate.format(asDate(d))}
              tick={{ fill: tokenVar("muted-foreground"), fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: tokenVar("border") }}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={current.domain ?? ["auto", "auto"]}
              tickFormatter={(v: number) => (current.formatAxis ?? current.format)(v)}
              tick={{ fill: tokenVar("muted-foreground"), fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickCount={4}
              ticks={current.ticks}
            />
            {current.band && (current.band.low !== null || current.band.high !== null) && (
              <ReferenceArea
                y1={current.band.low ?? undefined}
                y2={current.band.high ?? undefined}
                fill={tokenVar("success")}
                fillOpacity={0.08}
                stroke={tokenVar("success")}
                strokeOpacity={0.35}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            )}
            {current.target !== null && (
              <ReferenceLine
                y={current.target}
                stroke={tokenVar("muted-foreground")}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            )}
            <Tooltip
              cursor={{ stroke: tokenVar("muted-foreground"), strokeWidth: 1 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as
                  { date: IsoDate; value: number | null } | undefined;
                if (!active || !p) return null;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
                    <div className="font-medium">{longDate.format(asDate(p.date))}</div>
                    <div className="text-muted-foreground tabular-nums">
                      {p.value === null ? t.noValue : current.format(p.value)}
                    </div>
                  </div>
                );
              }}
              wrapperStyle={{ outline: "none", zIndex: 10 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={tokenVar("primary")}
              strokeWidth={2}
              connectNulls
              dot={
                many
                  ? false
                  : { r: 4, fill: tokenVar("primary"), stroke: tokenVar("card"), strokeWidth: 2 }
              }
              activeDot={{
                r: 5,
                fill: tokenVar("primary"),
                stroke: tokenVar("card"),
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
