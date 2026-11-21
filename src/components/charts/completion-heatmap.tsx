import { copy } from "@/copy";
import { cn } from "@/lib/utils";

export interface HeatmapDay {
  /** Day of month, 1–31. */
  day: number;
  /** Average habit progress 0–100, or null when nothing is logged / the day is in the future. */
  pct: number | null;
}

interface CompletionHeatmapProps {
  monthLabel: string;
  /** Weekday of the 1st, 0 = Monday … 6 = Sunday. */
  firstWeekday: number;
  days: readonly HeatmapDay[];
  today?: number;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Background class per level. Listed in full so Tailwind picks them up. */
export const HEATMAP_BG = [
  "bg-heatmap-0",
  "bg-heatmap-1",
  "bg-heatmap-2",
  "bg-heatmap-3",
  "bg-heatmap-4",
] as const;

/**
 * Text colour per level: normal text on the light steps, primary-foreground on the strong
 * steps. Contrast for both is checked in presets.test.ts.
 */
export const HEATMAP_INK = [
  "text-foreground",
  "text-foreground",
  "text-foreground",
  "text-primary-foreground",
  "text-primary-foreground",
] as const;

export function heatmapLevel(pct: number): 0 | 1 | 2 | 3 | 4 {
  if (pct >= 80) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  if (pct >= 20) return 1;
  return 0;
}

/** Month calendar where each day is shaded by how many habits were done (one hue, light → strong). */
export function CompletionHeatmap({
  monthLabel,
  firstWeekday,
  days,
  today,
}: CompletionHeatmapProps) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map(({ day, pct }) => {
          const level = pct === null ? null : heatmapLevel(pct);
          const label =
            pct === null
              ? `${monthLabel} ${day}`
              : `${monthLabel} ${day}: ${copy.report.habitsDone(pct)}`;
          return (
            <div
              key={day}
              title={label}
              aria-label={label}
              className={cn(
                "flex aspect-[4/3] items-center justify-center rounded-md text-xs font-medium tabular-nums",
                level === null
                  ? "border bg-card text-muted-foreground"
                  : [HEATMAP_BG[level], HEATMAP_INK[level]],
                day === today && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{copy.report.fewer}</span>
        {HEATMAP_BG.map((bg) => (
          <span key={bg} aria-hidden className={cn("size-3.5 rounded-sm", bg)} />
        ))}
        <span>{copy.report.more}</span>
      </div>
    </div>
  );
}
