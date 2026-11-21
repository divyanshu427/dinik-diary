import { copy } from "@/copy";
import {
  addDays,
  eachDay,
  parseIsoDate,
  startOfWeek,
  type IsoDate,
  type WeekStart,
} from "@/lib/core";
import { cn } from "@/lib/utils";
import { HEATMAP_BG, HEATMAP_INK, heatmapLevel } from "./completion-heatmap";

/*
 * Daily completion for any period. Same colours and scale as the month calendar on the brand
 * page (one hue, light → strong). Up to 6 weeks it's a calendar with day numbers; longer
 * periods become a compact grid (weeks across, weekdays down), scrolling sideways if needed.
 */

export interface PeriodHeatmapDay {
  date: IsoDate;
  /** Average progress 0–100; null when nothing was due. */
  pct: number | null;
  rest: boolean;
}

interface PeriodHeatmapProps {
  /** Every day of the period (days after today are drawn as "still to come"). */
  start: IsoDate;
  end: IsoDate;
  days: readonly PeriodHeatmapDay[];
  today: IsoDate;
  weekStart: WeekStart;
}

const t = copy.pages.reports.calendar;
const WEEKDAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayName = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const monthShort = new Intl.DateTimeFormat("en-IN", { month: "short" });
const asDate = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return new Date(year, month - 1, day);
};

export function PeriodHeatmap({ start, end, days, today, weekStart }: PeriodHeatmapProps) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const gridStart = startOfWeek(start, weekStart);
  const weekdays = weekStart === "monday" ? WEEKDAYS_MON : ["Sun", ...WEEKDAYS_MON.slice(0, 6)];
  const all = eachDay(gridStart, end);
  const compact = eachDay(start, end).length > 42;

  const cellLabel = (date: IsoDate) => {
    const name = dayName.format(asDate(date));
    if (date > today) return t.future(name);
    const d = byDate.get(date);
    return t.cell(name, d?.pct == null ? null : Math.round(d.pct), d?.rest ?? false);
  };

  const cellClass = (date: IsoDate) => {
    const d = byDate.get(date);
    if (date < start) return "invisible";
    if (date > today) return "border border-dashed bg-transparent text-muted-foreground";
    if (d?.rest) return "border border-dashed border-primary/50 bg-card text-muted-foreground";
    if (d?.pct == null) return "border bg-card text-muted-foreground";
    const level = heatmapLevel(d.pct);
    return cn(HEATMAP_BG[level], HEATMAP_INK[level]);
  };

  const legend = (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span>{copy.report.fewer}</span>
        {HEATMAP_BG.map((bg) => (
          <span key={bg} aria-hidden className={cn("size-3.5 rounded-sm", bg)} />
        ))}
        <span>{copy.report.more}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-3.5 rounded-sm border border-dashed border-primary/50" />
        {t.rest}
      </span>
    </div>
  );

  if (!compact) {
    return (
      <div>
        <div role="list" className="grid grid-cols-7 gap-1.5 text-center text-xs">
          {weekdays.map((d) => (
            <div key={d} aria-hidden className="pb-1 text-muted-foreground">
              {d}
            </div>
          ))}
          {all.map((date) => (
            <div
              key={date}
              role={date < start ? undefined : "listitem"}
              aria-hidden={date < start ? true : undefined}
              aria-label={date < start ? undefined : cellLabel(date)}
              title={date < start ? undefined : cellLabel(date)}
              data-day={date}
              className={cn(
                "flex aspect-[4/3] items-center justify-center rounded-md font-medium tabular-nums",
                cellClass(date),
                date === today && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
              )}
            >
              {parseIsoDate(date).day}
            </div>
          ))}
        </div>
        {legend}
      </div>
    );
  }

  // Compact: one column per week, one row per weekday. Fewer weeks → bigger squares.
  const weeks: IsoDate[][] = [];
  for (let w = gridStart; w <= end; w = addDays(w, 7)) weeks.push(eachDay(w, addDays(w, 6)));
  const cell = weeks.length <= 13 ? "1.5rem" : weeks.length <= 26 ? "1rem" : "0.875rem";
  const rows = { gridTemplateRows: `1rem repeat(7, ${cell})` };
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div
          aria-hidden
          style={rows}
          className="grid shrink-0 items-center gap-1 text-[10px] text-muted-foreground"
        >
          <span />
          {weekdays.map((d, i) => (
            <span key={d} className={cn(i % 2 === 1 && "invisible")}>
              {d}
            </span>
          ))}
        </div>
        <div role="list" className="flex gap-1">
          {weeks.map((week) => {
            const firstOfMonth = week.find((d) => d >= start && parseIsoDate(d).day === 1);
            const label = week[0] <= start && week[6] >= start ? start : firstOfMonth;
            return (
              <div key={week[0]} style={rows} className="grid gap-1">
                <span
                  aria-hidden
                  className="text-[10px] leading-4 whitespace-nowrap text-muted-foreground"
                >
                  {label ? monthShort.format(asDate(label)) : ""}
                </span>
                {week.map((date) =>
                  date < start || date > end ? (
                    <span key={date} aria-hidden style={{ width: cell, height: cell }} />
                  ) : (
                    <span
                      key={date}
                      role="listitem"
                      aria-label={cellLabel(date)}
                      title={cellLabel(date)}
                      data-day={date}
                      style={{ width: cell, height: cell }}
                      className={cn(
                        "rounded-[3px]",
                        cellClass(date),
                        date === today && "ring-1 ring-foreground",
                      )}
                    />
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>
      {legend}
    </div>
  );
}
