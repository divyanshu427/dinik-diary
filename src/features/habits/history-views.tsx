import { copy } from "@/copy";
import type { DayState, HabitDay } from "@/lib/core";
import { cn } from "@/lib/utils";

const t = copy.pages.habits;

const dateLabel = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const labelFor = (d: HabitDay) => {
  const [y, m, day] = d.date.split("-").map(Number);
  const state = t.dayStates[d.state];
  return state ? `${dateLabel.format(new Date(y, m - 1, day))}: ${state}` : "";
};

/**
 * One hue, strong → light, so "done" reads as the most filled (the same idea as the report heatmap).
 * Days that don't count (not due, rest, before start) are neutral, never coloured.
 */
const DOT: Record<DayState, string> = {
  done: "bg-primary",
  partial: "bg-heatmap-2",
  missed: "border border-muted-foreground/50",
  today: "border border-primary",
  "not-due": "bg-muted",
  rest: "bg-muted",
  "before-start": "bg-muted/40",
  future: "bg-transparent",
};

const CELL: Record<DayState, string> = {
  done: "bg-heatmap-4",
  partial: "bg-heatmap-2",
  missed: "bg-heatmap-0",
  today: "border-2 border-primary",
  "not-due": "border border-dashed border-border",
  rest: "border border-dashed border-border",
  "before-start": "border border-border/60",
  future: "",
};

export function summarize(days: readonly HabitDay[]) {
  const count = (s: DayState) => days.filter((d) => d.state === s).length;
  return { done: count("done"), partial: count("partial"), missed: count("missed") };
}

/** "Last 14 days" as a row of dots: filled = done, light = partial, outline = missed. */
export function HistoryDots({
  days,
  className,
}: {
  days: readonly HabitDay[];
  className?: string;
}) {
  const s = summarize(days);
  return (
    <div
      role="img"
      aria-label={t.historyLabel(s.done, s.partial, s.missed)}
      className={cn("flex items-center gap-1", className)}
    >
      {days.map((d) => (
        <span
          key={d.date}
          title={labelFor(d)}
          className={cn("size-2.5 shrink-0 rounded-full", DOT[d.state])}
        />
      ))}
    </div>
  );
}

/** "Last 30 days" heatmap: 10 per row, oldest first. */
export function HistoryHeatmap({ days }: { days: readonly HabitDay[] }) {
  const s = summarize(days);
  const legend = t.detail.legend;
  return (
    <div>
      <div
        role="img"
        aria-label={`${t.detail.last30}: ${s.done} ${legend.done.toLowerCase()}, ${s.partial} ${legend.partial.toLowerCase()}, ${s.missed} ${legend.missed.toLowerCase()}`}
        className="grid grid-cols-10 gap-1.5"
      >
        {days.map((d) => (
          <span
            key={d.date}
            title={labelFor(d)}
            className={cn("aspect-square rounded-md", CELL[d.state])}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <LegendItem className="bg-heatmap-4" label={legend.done} />
        <LegendItem className="bg-heatmap-2" label={legend.partial} />
        <LegendItem className="bg-heatmap-0" label={legend.missed} />
        <LegendItem className="border border-dashed border-border" label={legend.off} />
      </div>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("size-3 rounded-sm", className)} />
      {label}
    </span>
  );
}
