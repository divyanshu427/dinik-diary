"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { copy } from "@/copy";
import { tokenVar, type TokenName } from "@/theme/tokens";

export interface TimeSlice {
  key: string;
  label: string;
  hours: number;
  /** Colour token. Category slices use chart-1..8; folded ones chart-other; gaps chart-unlogged. */
  color: TokenName;
  /** A category's own custom colour (overrides the token). */
  fill?: string;
  /** Exact share, when the caller has it (e.g. the report engine's, which always totals 100). */
  percent?: number;
  /** How the amount reads in the legend, e.g. "148 h 2 min". Defaults to "{hours} h". */
  valueLabel?: string;
}

const fillOf = (s: TimeSlice) => s.fill ?? tokenVar(s.color);
const pctOf = (s: TimeSlice, total: number) =>
  s.percent ?? (total ? Math.round((s.hours / total) * 100) : 0);

interface TimeDonutProps {
  slices: readonly TimeSlice[];
  /** Key of the slice that represents unlogged time (excluded from the "logged" %). */
  unloggedKey?: string;
}

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

/**
 * Donut + legend table for time allocation. The legend always shows names, hours and %
 * so identity never relies on colour alone.
 */
export function TimeDonut({ slices, unloggedKey = "unlogged" }: TimeDonutProps) {
  const total = slices.reduce((sum, s) => sum + s.hours, 0);
  const unlogged = slices.find((s) => s.key === unloggedKey)?.hours ?? 0;
  const unloggedSlice = slices.find((s) => s.key === unloggedKey);
  const loggedPct =
    unloggedSlice?.percent !== undefined
      ? Math.round(100 - unloggedSlice.percent)
      : pct(total - unlogged, total);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <div className="relative size-48 shrink-0">
        <PieChart width={192} height={192} accessibilityLayer>
          <Pie
            data={slices as TimeSlice[]}
            dataKey="hours"
            nameKey="label"
            innerRadius={58}
            outerRadius={90}
            startAngle={90}
            endAngle={-270}
            stroke={tokenVar("card")}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={fillOf(s)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => (
              <DonutTooltip active={active} slice={payload?.[0]?.payload} total={total} />
            )}
            wrapperStyle={{ outline: "none", zIndex: 10 }}
          />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-semibold">{loggedPct}%</span>
          <span className="text-xs text-muted-foreground">{copy.report.logged}</span>
        </div>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {slices.map((s) => (
            <tr key={s.key} className="border-b last:border-0" data-slice={s.label}>
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-sm"
                    style={{ background: fillOf(s) }}
                  />
                  {s.label}
                </span>
              </td>
              <td className="py-1.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                {s.valueLabel ?? `${s.hours} h`}
              </td>
              <td className="w-14 py-1.5 text-right font-semibold tabular-nums">
                {pctOf(s, total)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DonutTooltip({
  active,
  slice,
  total,
}: {
  active?: boolean;
  slice?: TimeSlice;
  total: number;
}) {
  if (!active || !slice) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <div className="flex items-center gap-2 font-medium">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: fillOf(slice) }} />
        {slice.label}
      </div>
      <div className="text-muted-foreground tabular-nums">
        {slice.valueLabel ?? `${slice.hours} h`} · {pctOf(slice, total)}%
      </div>
    </div>
  );
}
