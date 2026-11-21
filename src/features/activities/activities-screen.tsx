"use client";

import { Plus, Shapes } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Dashboard, Panel } from "@/components/dashboard";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedControl } from "@/components/segmented-control";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import type { Activity } from "@/data/schema";
import { formatLongDate, formatNumber } from "@/features/today/format";
import { useActivities } from "@/hooks/use-activities";
import { useCategories, useHabits, useSettings } from "@/hooks/use-data";
import { useToday } from "@/hooks/use-today";
import { monthRange, weekRange, type IsoDate } from "@/lib/core";
import { cn } from "@/lib/utils";
import { ActivityRow } from "./activity-row";
import { CategoryManager } from "./category-manager";
import { byTimeOfDay, categoryColor, formatDuration, totalsByCategory } from "./summary";
import { useActivityActions } from "./use-activity-actions";

const t = copy.pages.activities;
type Period = "week" | "month" | "all";
type Filter = { kind: "all" } | { kind: "category"; id: string } | { kind: "tag"; tag: string };
const ALL: Filter = { kind: "all" };
const PERIODS = (["week", "month", "all"] as const).map((value) => ({
  value,
  label: t.periods[value],
}));
const short = (name: string) => name.split(" and ")[0];

export function ActivitiesScreen() {
  const settings = useSettings();
  const categories = useCategories();
  const activities = useActivities();
  const habits = useHabits();
  const today = useToday();
  const [period, setPeriod] = useState<Period>("week");
  const [filter, setFilter] = useState<Filter>(ALL);

  const actions = useActivityActions(categories.data ?? [], activities.data ?? []);
  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );

  if (categories.isError || activities.isError) {
    return (
      <>
        <PageHeader title={t.title} subtitle={t.subtitle} />
        <p role="alert" className="text-sm text-destructive">
          {t.loadError}
        </p>
      </>
    );
  }
  if (!settings.data || !categories.data || !activities.data || !habits.data || !today) {
    return (
      <>
        <PageHeader title={t.title} subtitle={t.subtitle} />
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </>
    );
  }

  const range =
    period === "week"
      ? weekRange(today, settings.data.weekStart)
      : period === "month"
        ? monthRange(today)
        : null;
  const inPeriod = activities.data.filter(
    (a) => !range || (a.date >= range.start && a.date <= range.end),
  );
  const shown = inPeriod.filter(
    (a) =>
      filter.kind === "all" ||
      (filter.kind === "category" ? a.categoryId === filter.id : a.tags.includes(filter.tag)),
  );

  // Summary tiles
  const minutes = inPeriod.reduce((sum, a) => sum + (a.durationMinutes ?? 0), 0);
  const days = new Set(inPeriod.map((a) => a.date)).size;
  const totals = totalsByCategory(inPeriod);
  const top = totals[0];
  const spend = inPeriod.reduce((sum, a) => sum + (a.spend ?? 0), 0);
  const timedTotals = totals.filter((x) => x.minutes > 0);
  const maxMinutes = Math.max(1, ...timedTotals.map((x) => x.minutes));

  // Filter chips: categories and tags used in this period
  const usedCategories = (categories.data ?? []).filter((c) =>
    inPeriod.some((a) => a.categoryId === c.id),
  );
  const usedTags = [...new Set(inPeriod.flatMap((a) => a.tags))].sort();
  const chips: { filter: Filter; label: string; title?: string }[] = [
    { filter: ALL, label: t.filters.all },
    ...usedCategories.map((c) => ({
      filter: { kind: "category", id: c.id } as Filter,
      label: short(c.name),
      title: c.name,
    })),
    ...usedTags.map((tag) => ({ filter: { kind: "tag", tag } as Filter, label: `#${tag}` })),
  ];
  const same = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b);

  // Entries grouped by day, newest day first
  const byDay = new Map<IsoDate, Activity[]>();
  for (const a of shown) byDay.set(a.date, [...(byDay.get(a.date) ?? []), a]);
  const dayList = [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));

  // How many activities / habits use each category (for delete and the "entries" count)
  const entryCount = new Map<string, number>();
  for (const a of activities.data)
    entryCount.set(a.categoryId, (entryCount.get(a.categoryId) ?? 0) + 1);
  const usage = new Map(entryCount);
  for (const h of habits.data)
    if (h.categoryId) usage.set(h.categoryId, (usage.get(h.categoryId) ?? 0) + 1);

  const e = actions.editor;

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow(inPeriod.length, formatDuration(minutes))}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label={t.periodLabel}
              options={PERIODS}
              value={period}
              onChange={setPeriod}
            />
            <Button onClick={() => actions.logNew(today)}>
              <Plus aria-hidden />
              {t.log}
            </Button>
          </div>
        }
      />

      <div aria-live="polite">
        {actions.error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
          >
            {actions.error}
          </p>
        )}
      </div>

      <Dashboard>
        <Cell span={12} fullOnTablet>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-5">
            <StatTile
              label={t.tiles.entries}
              value={String(inPeriod.length)}
              note={t.tiles.entriesNote(days)}
            />
            <StatTile
              label={t.tiles.time}
              value={minutes ? formatDuration(minutes) : t.tiles.none}
              note={t.tiles.timeNote}
            />
            <StatTile
              label={t.tiles.top}
              value={top ? short(categoryById.get(top.categoryId)?.name ?? "") : t.tiles.none}
              note={top ? t.tiles.topNote(formatDuration(top.minutes), top.entries) : undefined}
            />
            <StatTile
              label={t.tiles.spend}
              value={spend ? `${t.currency}${formatNumber(spend)}` : t.tiles.none}
              note={t.tiles.spendNote}
            />
          </div>
        </Cell>

        <Cell span={12} fullOnTablet>
          <div
            role="group"
            aria-label={t.filters.label}
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
          >
            {chips.map((chip) => {
              const active = same(chip.filter, filter);
              return (
                <button
                  key={chip.label}
                  type="button"
                  title={chip.title}
                  aria-pressed={active}
                  onClick={() => setFilter(chip.filter)}
                  className={cn(
                    "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:bg-muted",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </Cell>

        <Cell span={8} fullOnTablet className="flex flex-col gap-4">
          {dayList.length === 0 ? (
            <EmptyState icon={Shapes} title={t.emptyTitle} body={t.emptyBody}>
              <Button onClick={() => actions.logNew(today)}>
                <Plus aria-hidden />
                {t.log}
              </Button>
            </EmptyState>
          ) : (
            dayList.map(([date, list]) => {
              const dayMinutes = list.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);
              return (
                <section
                  key={date}
                  aria-label={formatLongDate(date)}
                  className="overflow-hidden rounded-2xl border bg-card text-card-foreground"
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b px-4 py-3">
                    <h2 className="font-heading font-semibold">{formatLongDate(date)}</h2>
                    <span className="text-sm text-muted-foreground">
                      {t.dayHeader(list.length, dayMinutes ? formatDuration(dayMinutes) : null)}
                    </span>
                  </header>
                  <ul className="divide-y">
                    {[...list].sort(byTimeOfDay).map((a) => (
                      <ActivityRow
                        key={a.id}
                        activity={a}
                        category={categoryById.get(a.categoryId)}
                        onEdit={actions.edit}
                        onDelete={actions.askDelete}
                        onDuplicate={
                          date === today ? undefined : (x) => actions.duplicate(x, today)
                        }
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </Cell>

        <Cell span={4} className="flex flex-col gap-4 md:col-span-2 xl:col-span-4">
          <Panel title={t.byCategory} subtitle={t.byCategoryHint}>
            {timedTotals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.byCategoryEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {timedTotals.map((x) => {
                  const c = categoryById.get(x.categoryId);
                  const share = Math.round((x.minutes / minutes) * 100);
                  return (
                    <li key={x.categoryId}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{ background: categoryColor(c) }}
                          />
                          <span className="truncate">{c?.name}</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {formatDuration(x.minutes)} ·{" "}
                          <span className="font-semibold text-foreground">{share}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-muted" aria-hidden>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(x.minutes / maxMinutes) * 100}%`,
                            background: categoryColor(c),
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel
            title={copy.pages.activities.categories.title}
            subtitle={copy.pages.activities.categories.hint}
          >
            <CategoryManager
              categories={categories.data}
              usage={usage}
              entries={entryCount}
              onCreate={(draft) => e.createCategory.mutateAsync([draft])}
              onUpdate={(id, draft) => e.updateCategory.mutateAsync([id, draft])}
              onArchive={(id, archived) => e.archiveCategory.mutateAsync([id, archived])}
              onDelete={(id) => actions.run(() => e.deleteCategory.mutateAsync([id]))}
              onMerge={(from, into) => e.mergeCategories.mutateAsync([from, into])}
            />
          </Panel>
        </Cell>
      </Dashboard>

      {actions.dialogs}
    </>
  );
}
