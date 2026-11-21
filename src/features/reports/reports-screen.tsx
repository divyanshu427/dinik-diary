"use client";

import {
  ChartPie,
  ChevronLeft,
  ChevronRight,
  Download,
  Lightbulb,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PeriodHeatmap } from "@/components/charts/period-heatmap";
import { TimeDonut, type TimeSlice } from "@/components/charts/time-donut";
import { Cell, Dashboard, Panel } from "@/components/dashboard";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedControl } from "@/components/segmented-control";
import { StatTile, type StatTone } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import type { Activity, Category, MetricKey } from "@/data/schema";
import { categoryColor, formatDuration } from "@/features/activities/summary";
import { formatClock, formatNumber } from "@/features/today/format";
import { useActivities } from "@/hooks/use-activities";
import {
  addDays,
  eachDay,
  parseIsoDate,
  SLEEP_KEY,
  UNLOGGED_KEY,
  type CategoryReport,
  type HabitReport,
  type IsoDate,
  type PeriodKind,
  type Slice,
  type Tone,
} from "@/lib/core";
import { downloadText } from "@/lib/download";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { formatMetric, insightText } from "./insight-text";
import { reportCsv } from "./report-csv";
import { TrendChart, type TrendSeries } from "./trend-chart";
import { useReport } from "./use-report";

const r = copy.pages.reports;

const PERIODS = (["week", "month", "all"] as const).map((value) => ({
  value,
  label: r.periods[value],
}));
const BASES = (["day", "waking"] as const).map((value) => ({ value, label: r.time.bases[value] }));

const asDate = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return new Date(year, month - 1, day);
};
const shortDay = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function periodLabel(kind: PeriodKind, start: IsoDate, end: IsoDate) {
  if (kind === "month") return monthYear.format(asDate(start));
  return `${dayMonth.format(asDate(start))} – ${dayMonthYear.format(asDate(end))}`;
}

const TREND_METRICS: readonly MetricKey[] = [
  "sleep_hours",
  "steps",
  "reels_minutes",
  "screen_time",
  "water",
  "weight",
  "mood",
  "energy",
];

type ReportResult = NonNullable<ReturnType<typeof useReport>["result"]>;

/** Phones: chips that show one part of the report at a time ("Overview" shows it all). */
type Section = "overview" | "time" | "days" | "habits" | "trends";
const SECTIONS: readonly Section[] = ["overview", "time", "days", "habits", "trends"];

/** The report page (Build Phase 10): a week, a month or all time, on the dashboard grid. */
export function ReportsScreen() {
  const [kind, setKind] = useState<PeriodKind>("month");
  const [anchor, setAnchor] = useState<IsoDate | null>(null);
  const [base, setBase] = useState<"day" | "waking">("day");
  const [exported, setExported] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const router = useRouter();
  const setSelectedDate = useUiStore((st) => st.setSelectedDate);
  /** Hides a card on phones unless the chosen section includes it. */
  const inSection = (...sections: Section[]) =>
    section === "overview" || sections.includes(section) ? undefined : "max-md:hidden";
  const { result, isError } = useReport(kind, anchor);
  const activities = useActivities();

  if (isError) {
    return (
      <>
        <PageHeader title={r.title} />
        <p role="alert" className="text-sm text-destructive">
          {r.loadError}
        </p>
      </>
    );
  }
  if (!result) {
    return (
      <>
        <PageHeader title={r.title} />
        <p className="text-sm text-muted-foreground">{r.loading}</p>
      </>
    );
  }

  const { report, comparison, insights, settings, today, habitById, categoryById } = result;
  const { range } = report;
  const shownEnd = range.end < today ? range.end : today;
  const last = kind === "all" ? null : r.lastPeriod[kind];
  const names = {
    habit: (id: string) => habitById.get(id)?.name ?? "?",
    category: (id: string) => categoryById.get(id)?.name ?? "?",
    period: (kind === "week" ? "week" : "month") as "week" | "month",
  };
  const hasData =
    report.loggedDays > 0 || report.categories.length > 0 || Object.keys(report.metrics).length > 0;

  const exportCsv = () => {
    const name = r.csvName(range.start, shownEnd);
    downloadText(
      name,
      reportCsv({
        report,
        metrics: result.metrics,
        categories: result.categories,
        today,
        nowMinute: result.nowMinute,
      }),
      "text/csv;charset=utf-8",
    );
    setExported(r.exported(name));
  };

  const header = (
    <>
      <PageHeader
        eyebrow={periodLabel(kind, range.start, shownEnd)}
        title={r.title}
        subtitle={r.subtitle}
        inlineActions
        className="mb-4"
        actions={
          <Button
            data-tour="reports-csv"
            variant="outline"
            onClick={exportCsv}
            disabled={!hasData}
            aria-label={r.exportCsv}
          >
            <Download aria-hidden />
            <span className="max-sm:hidden">{r.exportCsv}</span>
            <span className="sm:hidden">{r.csvShort}</span>
          </Button>
        }
      />
      <div data-tour="reports-period" className="mb-6 flex flex-wrap items-center gap-2">
        <SegmentedControl
          label={r.periodLabel}
          options={PERIODS}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setAnchor(null);
          }}
          className="max-sm:flex-1 max-sm:*:flex-1"
        />
        {kind !== "all" && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full"
              aria-label={r.previousPeriod}
              onClick={() => setAnchor(addDays(range.start, -1))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full"
              aria-label={r.nextPeriod}
              disabled={range.end >= today}
              onClick={() => {
                const next = addDays(range.end, 1);
                setAnchor(next >= today ? null : next);
              }}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </>
  );

  if (!hasData) {
    return (
      <>
        {header}
        <EmptyState icon={ChartPie} title={r.empty.title} body={r.empty.body}>
          <Link
            href="/settings"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {r.empty.demo}
          </Link>
        </EmptyState>
      </>
    );
  }

  // ----- tiles -----
  const progressChange = comparison?.averageProgress.change ?? null;
  const toneOf = (change: number | null, higherIsBetter: boolean): StatTone =>
    change === null || change === 0
      ? "neutral"
      : change > 0 === higherIsBetter
        ? "positive"
        : "warning";
  const longest = report.habits.reduce<HabitReport | null>(
    (best, h) => (h.streak.current > (best?.streak.current ?? 0) ? h : best),
    null,
  );
  const reels = report.metrics.reels_minutes;
  const reelsChange = comparison?.metrics.reels_minutes?.changePct ?? null;
  const top = report.categories.find(
    (c) => c.categoryId !== result.sleepCategoryId && c.minutes > 0,
  );

  return (
    <>
      {header}
      <p aria-live="polite" className="sr-only">
        {exported}
      </p>

      <div
        data-tour="reports-sections"
        role="group"
        aria-label={r.sections.label}
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden"
      >
        {SECTIONS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={section === value}
            onClick={() => setSection(value)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              section === value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {r.sections[value]}
          </button>
        ))}
      </div>

      {/* Phones put the cards in the mock-up's order: tiles, insights, days, time, habits, trends, categories. */}
      <Dashboard>
        <Cell span={12} fullOnTablet className={cn("max-md:order-1", inSection())}>
          <div
            className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-5"
            data-testid="report-tiles"
            data-tour="reports-tiles"
          >
            <StatTile
              label={r.tiles.completion}
              value={
                report.averageProgress !== null
                  ? `${Math.round(report.averageProgress)}%`
                  : r.tiles.none
              }
              note={
                progressChange !== null && last
                  ? r.tiles.change(Math.round(progressChange), last)
                  : r.tiles.completionNote(report.scoredDays)
              }
              tone={last ? toneOf(progressChange, true) : "neutral"}
            />
            <StatTile
              label={r.tiles.streak}
              value={
                longest
                  ? copy.pages.habits.streakValue(longest.streak.current, longest.streak.unit)
                  : r.tiles.none
              }
              note={longest ? names.habit(longest.habitId) : r.tiles.streakNone}
            />
            <StatTile
              label={r.tiles.reels}
              value={
                reels?.average != null
                  ? r.tiles.reelsValue(formatDuration(Math.round(reels.average)))
                  : r.tiles.none
              }
              note={
                reels?.average == null
                  ? r.tiles.reelsNone
                  : reelsChange !== null && last
                    ? r.tiles.reelsChange(reelsChange, last)
                    : undefined
              }
              tone={last ? toneOf(reelsChange, false) : "neutral"}
            />
            <StatTile
              label={top ? names.category(top.categoryId) : r.tiles.top}
              value={top ? r.tiles.topValue(top.entries) : r.tiles.none}
              note={top ? r.tiles.total(formatDuration(top.minutes)) : r.tiles.topNone}
            />
          </div>
        </Cell>

        <Panel
          span={7}
          className={cn("max-md:order-4", inSection("time"))}
          tour="reports-time"
          title={r.time.title}
          subtitle={
            base === "day"
              ? r.time.subtitle(formatDuration(report.time.totalMinutes))
              : r.time.subtitleWaking(
                  formatDuration(report.time.totalMinutes - report.time.sleepMinutes),
                )
          }
        >
          <div className="mb-4 flex justify-end">
            <SegmentedControl
              label={r.time.base}
              options={BASES}
              value={base}
              onChange={setBase}
              className="max-sm:flex max-sm:w-full max-sm:*:flex-1"
            />
          </div>
          <TimeCard
            slices={base === "day" ? report.time.day : report.time.waking}
            categories={result.categories}
          />
        </Panel>

        <Panel
          span={5}
          className={cn("max-md:order-3", inSection("days"))}
          tour="reports-calendar"
          title={r.calendar.title}
          subtitle={r.calendar.subtitle(
            report.daysFullyDone,
            report.daysAtThreshold,
            settings.unlockThreshold,
          )}
        >
          <PeriodHeatmap
            start={range.start}
            end={kind === "all" ? shownEnd : range.end}
            days={report.days.map((d) => ({ date: d.date, pct: d.average, rest: d.rest }))}
            today={today}
            weekStart={settings.weekStart}
            onPick={(date) => {
              setSelectedDate(date >= today ? null : date);
              router.push("/");
            }}
          />
          {(report.bestDay || report.worstDay) && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" data-testid="best-worst">
              {report.bestDay && (
                <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                  <dt className="text-muted-foreground">{r.calendar.best}</dt>
                  <dd className="font-semibold">
                    {r.calendar.dayValue(
                      shortDay.format(asDate(report.bestDay.date)),
                      Math.round(report.bestDay.average),
                    )}
                  </dd>
                </div>
              )}
              {report.worstDay && (
                <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                  <dt className="text-muted-foreground">{r.calendar.worst}</dt>
                  <dd className="font-semibold">
                    {r.calendar.dayValue(
                      shortDay.format(asDate(report.worstDay.date)),
                      Math.round(report.worstDay.average),
                    )}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </Panel>

        <Panel
          span={7}
          className={cn("max-md:order-7", inSection("time"))}
          tour="reports-categories"
          title={r.categories.title}
          subtitle={r.categories.subtitle}
          bodyClassName="-mx-5 -mb-5"
        >
          <CategoryList
            totals={report.categories}
            categoryById={categoryById}
            activities={activities.data ?? []}
          />
        </Panel>

        <Panel
          span={5}
          className={cn("max-md:order-2", inSection("habits"))}
          tour="reports-insights"
          title={r.insights.title}
          subtitle={r.insights.subtitle}
        >
          {insights.length === 0 ? (
            <EmptyState icon={Lightbulb} title={r.insights.empty} className="border-0 py-4" />
          ) : (
            <ul className="flex flex-col gap-3" data-testid="insights">
              {insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <ToneIcon tone={insight.tone} />
                  <span>{insightText(insight, names)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          span={5}
          className={cn("max-md:order-5", inSection("habits"))}
          tour="reports-ranking"
          title={r.ranking.title}
          subtitle={r.ranking.subtitle}
        >
          <Ranking habits={report.habits} name={names.habit} />
          {report.habits.length > 0 && (
            <Link
              href="/habits"
              className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {r.ranking.seeAll(report.habits.length)}
            </Link>
          )}
        </Panel>

        <Panel
          span={7}
          className={cn("max-md:order-6", inSection("trends"))}
          tour="reports-trends"
          title={r.trends.title}
          subtitle={r.trends.subtitle}
        >
          <TrendChart series={trendSeries(result)} />
        </Panel>
      </Dashboard>
    </>
  );
}

// ---------- time donut ----------

function TimeCard({
  slices,
  categories,
}: {
  slices: readonly Slice[];
  categories: readonly Category[];
}) {
  if (slices.every((s) => s.key === UNLOGGED_KEY)) {
    return <p className="text-sm text-muted-foreground">{r.time.empty}</p>;
  }
  const byId = new Map(categories.map((c) => [c.id, c]));
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const shared = (c: Category | undefined) =>
    !c || (c.colorToken === "chart-other" && !c.customColor);

  // Categories without their own colour share one grey: fold them into "Other" so no two slices
  // look alike. Slices go in palette order (the order checked for colour-blind safety).
  const own = slices
    .filter((s) => s.key !== UNLOGGED_KEY && s.key !== SLEEP_KEY && !shared(byId.get(s.key)))
    .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  const folded = slices.filter(
    (s) => s.key === SLEEP_KEY || (s.key !== UNLOGGED_KEY && shared(byId.get(s.key))),
  );
  const unlogged = slices.find((s) => s.key === UNLOGGED_KEY);

  const donut: TimeSlice[] = own.map((s) => {
    const c = byId.get(s.key)!;
    return {
      key: s.key,
      label: c.name,
      hours: s.minutes / 60,
      color: c.colorToken,
      fill: c.customColor ? categoryColor(c) : undefined,
      percent: s.percent,
      valueLabel: formatDuration(s.minutes),
    };
  });
  if (folded.length) {
    const minutes = folded.reduce((a, s) => a + s.minutes, 0);
    const only = folded.length === 1 ? folded[0] : null;
    donut.push({
      key: "other",
      label: only
        ? only.key === SLEEP_KEY
          ? r.time.sleep
          : (byId.get(only.key)?.name ?? "?")
        : r.time.other(folded.length),
      hours: minutes / 60,
      color: "chart-other",
      percent: Math.round(folded.reduce((a, s) => a + s.percent, 0) * 10) / 10,
      valueLabel: formatDuration(minutes),
    });
  }
  if (unlogged) {
    donut.push({
      key: UNLOGGED_KEY,
      label: r.time.unlogged,
      hours: unlogged.minutes / 60,
      color: "chart-unlogged",
      percent: unlogged.percent,
      valueLabel: formatDuration(unlogged.minutes),
    });
  }
  return (
    <div data-testid="time-donut">
      <TimeDonut slices={donut} unloggedKey={UNLOGGED_KEY} />
    </div>
  );
}

// ---------- categories ----------

function CategoryList({
  totals,
  categoryById,
  activities,
}: {
  totals: readonly CategoryReport[];
  categoryById: ReadonlyMap<string, Category>;
  activities: readonly Activity[];
}) {
  if (totals.length === 0) {
    return <p className="px-5 pb-5 text-sm text-muted-foreground">{r.categories.empty}</p>;
  }
  const byId = new Map(activities.map((a) => [a.id, a]));
  return (
    <ul className="divide-y border-t" data-testid="categories">
      {totals.map((c) => {
        const category = categoryById.get(c.categoryId);
        const entries = c.activityIds
          .map((id) => byId.get(id))
          .filter((a): a is Activity => !!a)
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
          );
        return (
          <li key={c.categoryId} data-category={category?.name}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                />
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: categoryColor(category) }}
                />
                <span className="min-w-0 flex-1 font-medium">{category?.name ?? "?"}</span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {r.categories.summary(c.entries, formatDuration(c.minutes))}
                </span>
              </summary>
              <ul className="bg-muted/30 py-1 text-sm">
                {c.missingDuration > 0 && (
                  <li className="px-5 pt-2 text-xs text-warning sm:px-12">
                    {r.categories.missing(c.missingDuration)}
                  </li>
                )}
                {entries.map((a) => (
                  <li
                    key={a.id}
                    className="grid grid-cols-[1fr_auto] gap-x-3 px-5 py-1.5 sm:flex sm:items-baseline sm:px-12"
                  >
                    <span className="text-muted-foreground sm:w-28 sm:shrink-0">
                      {shortDay.format(asDate(a.date))}
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums sm:order-last sm:shrink-0">
                      {a.startTime && `${formatClock(a.startTime)} · `}
                      {a.durationMinutes != null
                        ? formatDuration(a.durationMinutes)
                        : r.categories.noDuration}
                    </span>
                    <span className="col-span-2 min-w-0 sm:flex-1">
                      {a.title}
                      {a.place && <span className="text-muted-foreground"> · {a.place}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- habit ranking ----------

function Ranking({
  habits,
  name,
}: {
  habits: readonly HabitReport[];
  name: (id: string) => string;
}) {
  const ranked = habits
    .filter((h) => h.percent !== null)
    .sort((a, b) => b.percent! - a.percent! || b.doneDays - a.doneDays);
  if (ranked.length === 0)
    return <p className="text-sm text-muted-foreground">{r.ranking.empty}</p>;

  // Top 5 and bottom 5; with 10 or fewer habits, split the list in half so nothing repeats.
  const half = Math.ceil(ranked.length / 2);
  const top = ranked.slice(0, Math.min(5, half));
  const bottom = ranked.slice(Math.max(half, ranked.length - 5)).reverse();

  const list = (title: string, items: HabitReport[], testId: string) => (
    <section aria-label={title}>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="flex flex-col gap-2.5" data-testid={testId}>
        {items.map((h) => (
          <li key={h.habitId} className="text-sm" data-habit={name(h.habitId)}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">{name(h.habitId)}</span>
              <span className="shrink-0 font-medium tabular-nums">{Math.round(h.percent!)}%</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${h.percent}%` }}
                />
              </span>
              <span className="shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground">
                {r.ranking.streak(copy.pages.habits.streakValue(h.streak.current, h.streak.unit))}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
      {list(r.ranking.top, top, "ranking-top")}
      {bottom.length > 0 && list(r.ranking.bottom, bottom, "ranking-bottom")}
    </div>
  );
}

// ---------- trends ----------

function trendSeries(result: ReportResult): TrendSeries[] {
  const { report, today, metrics, settings } = result;
  const end = report.range.end < today ? report.range.end : today;
  const dates = eachDay(report.range.start, end);
  const byKey = new Map<string, Map<IsoDate, number>>();
  for (const m of metrics) {
    if (m.valueNum === null) continue;
    if (!byKey.has(m.key)) byKey.set(m.key, new Map());
    byKey.get(m.key)!.set(m.date, m.valueNum);
  }
  const labels = copy.pages.today.metrics.labels as Record<string, string>;
  const one = (v: number) => formatNumber(Math.round(v * 10) / 10);

  const completion: TrendSeries = {
    key: "completion",
    label: r.trends.completion,
    points: report.days.map((d) => ({
      date: d.date,
      value: d.rest || !d.complete ? null : d.average,
    })),
    format: (v) => `${Math.round(v)}%`,
    domain: [0, 100],
    ticks: [0, 25, 50, 75, 100],
    target: settings.unlockThreshold,
    average: report.averageProgress,
  };

  const metricSeries = TREND_METRICS.map((key): TrendSeries => ({
    key,
    label: labels[key] ?? copy.pages.insights.metricLabels[key] ?? key,
    points: dates.map((date) => ({ date, value: byKey.get(key)?.get(date) ?? null })),
    format: (v) =>
      key === "weight"
        ? `${one(v)} ${settings.units === "imperial" ? "lb" : "kg"}`
        : key === "mood" || key === "energy"
          ? one(v)
          : formatMetric(key, v),
    formatAxis:
      key === "steps"
        ? (v) => (v >= 1000 ? `${one(v / 1000)}k` : formatNumber(Math.round(v)))
        : key === "sleep_hours"
          ? (v) => `${one(v)} h`
          : key === "reels_minutes" || key === "screen_time"
            ? (v) => `${Math.round(v)} min`
            : undefined,
    target: result.metricTarget(key),
    average: report.metrics[key]?.average ?? null,
  }));
  return [completion, ...metricSeries];
}

function ToneIcon({ tone }: { tone: Tone }) {
  if (tone === "positive")
    return <TrendingUp aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />;
  if (tone === "negative")
    return <TrendingDown aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />;
  return <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
}
