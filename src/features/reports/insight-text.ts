import { copy } from "@/copy";
import type { MetricKey } from "@/data/schema";
import { formatDuration } from "@/features/activities/summary";
import { formatClock, formatNumber } from "@/features/today/format";
import type { HabitInsight, Insight } from "@/lib/core";

/* Insights as sentences. The engine (src/lib/core/insights.ts) only returns the facts. */

const t = copy.pages.insights;

export interface InsightNames {
  habit: (id: string) => string;
  category: (id: string) => string;
  /** "week" or "month": what "last …" refers to. */
  period: "week" | "month";
}

/** "52 min", "6,200 steps", "7.2 h", "2.5 L" */
export function formatMetric(key: MetricKey, value: number): string {
  switch (key) {
    case "reels_minutes":
    case "screen_time":
      return formatDuration(Math.round(value));
    case "steps":
      return `${formatNumber(Math.round(value))} ${copy.pages.today.metrics.units.steps}`;
    case "sleep_hours":
      return formatDuration(Math.round(value * 60));
    case "water":
      return `${formatNumber(Math.round(value * 10) / 10)} ${copy.pages.today.metrics.units.water}`;
    default:
      return formatNumber(Math.round(value * 10) / 10);
  }
}

export function insightText(insight: Insight, names: InsightNames): string {
  switch (insight.kind) {
    case "progress-change":
      return t.progressChange(Math.round(insight.current), insight.change, names.period);
    case "metric-change":
      return t.metricChange(
        t.metricLabels[insight.metric] ?? insight.metric,
        formatMetric(insight.metric, insight.average),
        insight.changePct,
        names.period,
      );
    case "skip-together":
      return t.skipTogether(
        names.habit(insight.habitId),
        insight.both,
        insight.of,
        names.habit(insight.withHabitId),
      );
    case "bedtime-effect":
      return t.bedtimeEffect(formatClock(insight.bedBy), insight.earlyAverage, insight.lateAverage);
    case "category-change":
      return t.categoryChange(
        names.category(insight.categoryId),
        formatDuration(Math.abs(insight.perDay - insight.previousPerDay)),
        insight.perDay > insight.previousPerDay,
        names.period,
      );
  }
}

export function habitInsightText(insight: HabitInsight): string {
  if (insight.kind === "trend") return t.trend(insight.before, insight.recent);
  const best = insight.best ? t.bestOn[insight.best] : null;
  const worst = insight.worst
    ? insight.worst[0] === insight.worst[1]
      ? t.onDays(t.weekdayPlural[insight.worst[0]])
      : t.dayRange(t.weekdays[insight.worst[0]], t.weekdays[insight.worst[1]])
    : null;
  return t.pattern(best, worst);
}
