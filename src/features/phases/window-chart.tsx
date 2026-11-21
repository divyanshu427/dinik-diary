"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { copy } from "@/copy";
import { parseIsoDate, type IsoDate, type ReadinessDay } from "@/lib/core";
import { tokenVar } from "@/theme/tokens";

const t = copy.pages.phases.chart;
const dayShort = new Intl.DateTimeFormat("en-IN", { day: "numeric" });
const dayLong = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const asDate = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return new Date(year, month - 1, day);
};

/** Each day of the current window as a bar, with the unlock target as a dashed line. */
export function WindowChart({
  days,
  threshold,
}: {
  days: readonly ReadinessDay[];
  threshold: number;
}) {
  if (days.length === 0) return <p className="text-sm text-muted-foreground">{t.empty}</p>;

  const label = (d: ReadinessDay) =>
    t.day(dayLong.format(asDate(d.date)), d.average, d.today, d.logged);
  const data = days.map((d) => ({ ...d, value: d.average ?? 0 }));

  return (
    <div>
      <div className="h-48 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            barCategoryGap={3}
          >
            <CartesianGrid vertical={false} stroke={tokenVar("border")} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => dayShort.format(asDate(d))}
              tick={{ fill: tokenVar("muted-foreground"), fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: tokenVar("border") }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: tokenVar("muted-foreground"), fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <ReferenceLine
              y={threshold}
              stroke={tokenVar("foreground")}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Tooltip
              cursor={{ fill: tokenVar("muted"), opacity: 0.6 }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as ReadinessDay | undefined;
                if (!active || !d) return null;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
                    {label(d)}
                  </div>
                );
              }}
              wrapperStyle={{ outline: "none", zIndex: 10 }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell
                  key={d.date}
                  fill={tokenVar(
                    d.today ? "heatmap-2" : (d.average ?? 0) >= threshold ? "primary" : "heatmap-3",
                  )}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* The same days as text, for screen readers. */}
      <ul className="sr-only">
        {days.map((d) => (
          <li key={d.date}>{label(d)}</li>
        ))}
      </ul>
    </div>
  );
}
