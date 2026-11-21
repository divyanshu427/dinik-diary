import { Lightbulb, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import type { Category, Habit, HabitTarget, Phase, TargetUpgrade } from "@/data/schema";
import { SEED_TARGET_FROM } from "@/data/seed/defaults";
import { habitInsightText } from "@/features/reports/insight-text";
import { habitInsights, targetOn, type HabitDay, type HabitStats } from "@/lib/core";
import { describeSchedule, describeTarget } from "./format";
import { HistoryHeatmap } from "./history-views";
import { phaseLabel } from "./format";

const t = copy.pages.habits;
const d = t.detail;

const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const fmt = (iso: string) => {
  const [y, m, day] = iso.split("-").map(Number);
  return shortDate.format(new Date(y, m - 1, day));
};

interface HabitDetailProps {
  habit: Habit;
  phase: Phase | undefined;
  category: Category | undefined;
  targets: readonly HabitTarget[];
  stats14: HabitStats | undefined;
  stats30: HabitStats | undefined;
  /** The last 8 weeks, for insights. */
  recentDays?: readonly HabitDay[];
  /** Target changes waiting in locked phases ("becomes 8,000 in Phase 2"). */
  upcoming?: { phase: Phase; upgrade: TargetUpgrade }[];
  today: string;
  onEdit: () => void;
  /** Rendered inside a dialog on phones: the dialog supplies the title. */
  hideTitle?: boolean;
}

/** Everything about one habit: target, streaks, last 30 days, target history. */
export function HabitDetail({
  habit,
  phase,
  category,
  targets,
  stats14,
  stats30,
  recentDays,
  upcoming = [],
  today,
  onEdit,
  hideTitle,
}: HabitDetailProps) {
  const insights = recentDays ? habitInsights(recentDays) : [];
  const current = targetOn(targets, today);
  const history = [...targets].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const streak = stats14?.streak;
  const hasCheckIns = (stats30?.days ?? []).some((x) =>
    ["done", "partial", "missed"].includes(x.state),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {!hideTitle && <h2 className="font-heading text-xl font-semibold">{habit.name}</h2>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {phase && <Badge variant="secondary">{phaseLabel(phase)}</Badge>}
            {category && <Badge variant="outline">{category.name}</Badge>}
            {habit.partOfDay !== "anytime" && (
              <Badge variant="outline">{t.partsOfDay[habit.partOfDay]}</Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil aria-hidden />
          {d.edit}
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{d.target}</dt>
          <dd className="font-medium">{describeTarget(habit, current)}</dd>
          {upcoming.map(({ phase: p, upgrade }) => (
            <dd key={p.id} className="text-xs text-muted-foreground" data-testid="upcoming-target">
              {d.becomes(describeTarget(habit, upgrade), phaseLabel(p))}
            </dd>
          ))}
        </div>
        <div>
          <dt className="text-muted-foreground">{d.schedule}</dt>
          <dd className="font-medium">{describeSchedule(habit.schedule)}</dd>
        </div>
      </dl>

      <dl className="grid grid-cols-3 divide-x rounded-xl border">
        <Stat
          label={d.currentStreak}
          value={streak ? t.streakValue(streak.current, streak.unit) : t.kpi.none}
        />
        <Stat
          label={d.bestStreak}
          value={streak ? t.streakValue(streak.best, streak.unit) : t.kpi.none}
        />
        <Stat
          label={d.last14}
          value={stats14?.percent != null ? `${Math.round(stats14.percent)}%` : t.kpi.none}
        />
      </dl>

      {insights.length > 0 && (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-accent px-3 py-2.5 text-sm text-accent-foreground"
          data-testid="habit-insight"
        >
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="sr-only">{copy.pages.insights.habitTitle}: </span>
            {insights.map(habitInsightText).join(" ")}
          </p>
        </div>
      )}

      <section aria-labelledby="habit-last30">
        <h3 id="habit-last30" className="mb-2 text-sm font-semibold">
          {d.last30}
        </h3>
        {stats30 && <HistoryHeatmap days={stats30.days} />}
        {!hasCheckIns && <p className="mt-2 text-sm text-muted-foreground">{d.noCheckIns}</p>}
      </section>

      {habit.type !== "boolean" && history.length > 0 && (
        <section aria-labelledby="habit-target-history">
          <h3 id="habit-target-history" className="mb-2 text-sm font-semibold">
            {d.targetHistory}
          </h3>
          <ul className="flex flex-col divide-y text-sm">
            {history.map((target) => (
              <li key={target.id} className="flex justify-between gap-3 py-1.5">
                <span className="font-medium">{describeTarget(habit, target)}</span>
                <span className="text-muted-foreground">{rangeLabel(target)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function rangeLabel(target: HabitTarget) {
  const from = target.validFrom <= SEED_TARGET_FROM ? d.fromStart : fmt(target.validFrom);
  if (target.validTo === null)
    return target.validFrom <= SEED_TARGET_FROM ? d.current : d.since(fmt(target.validFrom));
  return d.range(from, fmt(target.validTo));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-semibold">{value}</dd>
    </div>
  );
}
