import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "positive" | "warning";

interface StatTileProps {
  label: string;
  value: string;
  note?: string;
  tone?: StatTone;
  className?: string;
}

const toneClass: Record<StatTone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-success",
  warning: "text-warning",
};

/** A single headline number, e.g. "Habit completion 74%". */
export function StatTile({ label, value, note, tone = "neutral", className }: StatTileProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 text-card-foreground", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      {note && <p className={cn("mt-1 text-sm font-medium", toneClass[tone])}>{note}</p>}
    </div>
  );
}
