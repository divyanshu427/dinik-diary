"use client";

import { Moon, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Panel, type Span } from "@/components/dashboard";
import { EmptyState } from "@/components/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { planOverlapFix } from "@/data/activity-ops";
import type { Habit, HabitTarget } from "@/data/schema";
import { categoryColor, formatDuration } from "@/features/activities/summary";
import { useActivityActions } from "@/features/activities/use-activity-actions";
import { formatClock } from "@/features/today/format";
import { useActivities } from "@/hooks/use-activities";
import { useCategories } from "@/hooks/use-data";
import { useMetrics } from "@/hooks/use-metrics";
import { MINUTES_PER_DAY, minuteToTime, targetOn, type IsoDate } from "@/lib/core";
import { cn } from "@/lib/utils";
import { buildDayTimeline, type TimelineItem, type TimelineOverlap } from "./day-timeline";

const t = copy.pages.today.timeline;

interface TimelinePanelProps {
  date: IsoDate;
  today: IsoDate;
  dayStartHour: number;
  /** Minutes into the day right now, when viewing today. */
  nowMinute: number | null;
  /** All habits and targets: the wake-up and bedtime targets set the waking window. */
  habits: readonly Habit[];
  targetsByHabit: ReadonlyMap<string, HabitTarget[]>;
  span?: Span;
}

/** "Today's timeline": sleep, activities and unlogged gaps; "Fill the gap"; overlap fixes. */
export function TimelinePanel({
  date,
  today,
  dayStartHour,
  nowMinute,
  habits,
  targetsByHabit,
  span = 8,
}: TimelinePanelProps) {
  const activities = useActivities();
  const categories = useCategories();
  const metrics = useMetrics();
  const actions = useActivityActions(categories.data ?? [], activities.data ?? []);
  const [toFix, setToFix] = useState<TimelineOverlap | null>(null);

  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );
  const live = habits.filter((h) => !h.archived);
  const targetTime = (key: "wake_time" | "bed_time") => {
    const habit = live.find((h) => h.metricKey === key);
    return habit
      ? (targetOn(targetsByHabit.get(habit.id) ?? [], date)?.targetTime ?? undefined)
      : undefined;
  };
  const sleepHabit = live.find(
    (h) =>
      h.categoryId &&
      (h.metricKey === "bed_time" || h.metricKey === "sleep_hours" || h.metricKey === "wake_time"),
  );
  const sleepColor = categoryColor(
    sleepHabit?.categoryId ? categoryById.get(sleepHabit.categoryId) : undefined,
  );

  const timeline = useMemo(
    () =>
      buildDayTimeline({
        date,
        dayStartHour,
        activities: activities.data ?? [],
        metrics: metrics.data ?? [],
        defaultWake: targetTime("wake_time"),
        defaultBed: targetTime("bed_time"),
        nowMinute: date === today ? nowMinute : null,
      }),
    // targetTime only reads habits, targets and date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, today, dayStartHour, activities.data, metrics.data, nowMinute, habits, targetsByHabit],
  );

  const clock = (minute: number) => formatClock(minuteToTime(minute, dayStartHour));
  const range = (start: number, end: number) => t.range(clock(start), clock(end));
  const fill = (start: number, end: number) =>
    actions.logNew(date, {
      startTime: minuteToTime(start, dayStartHour),
      endTime: minuteToTime(end, dayStartHour),
    });

  const colorOf = (item: TimelineItem) =>
    item.kind === "sleep"
      ? sleepColor
      : item.kind === "activity"
        ? categoryColor(categoryById.get(item.activity.categoryId))
        : undefined;

  const loading = activities.isPending || categories.isPending || metrics.isPending;
  const [firstGap, ...otherGaps] = timeline.gaps;
  const placed = timeline.items.some((i) => i.kind !== "gap");
  const fix = toFix ? planOverlapFix(toFix.loser, toFix.winner, dayStartHour) : null;

  return (
    <Panel
      span={span}
      title={date === today ? t.title : t.titleOther}
      subtitle={t.subtitle(clock(0), formatDuration(timeline.placedMinutes))}
      className="overflow-hidden"
    >
      {actions.error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {actions.error}
        </p>
      )}
      {loading ? null : (
        <div className="grid gap-4">
          {firstGap && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-accent-foreground">
              <div className="min-w-0">
                <p className="font-medium">
                  {t.gapPrompt(clock(firstGap.start), clock(firstGap.end))}
                </p>
                <p className="text-sm">
                  {t.gapPromptHint}
                  {otherGaps.length > 0 && ` ${t.moreGaps(otherGaps.length)}`}
                </p>
              </div>
              <Button size="sm" onClick={() => fill(firstGap.start, firstGap.end)}>
                <Plus aria-hidden />
                {t.fillGap}
              </Button>
            </div>
          )}

          {timeline.overlaps.map((o) => (
            <div
              key={`${o.winner.id}-${o.loser.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/50 px-4 py-3"
            >
              <p className="flex min-w-0 items-start gap-2 text-sm">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  <span className="font-medium">
                    {t.overlap(o.loser.title, o.winner.title, clock(o.start), clock(o.end))}
                  </span>{" "}
                  <span className="text-muted-foreground">{t.overlapHint}</span>
                </span>
              </p>
              <Button
                size="sm"
                variant="outline"
                aria-label={`${t.fix}: ${t.overlap(o.loser.title, o.winner.title, clock(o.start), clock(o.end))}`}
                onClick={() => setToFix(o)}
              >
                {t.fix}
              </Button>
            </div>
          ))}

          <DayStrip
            items={timeline.items}
            colorOf={colorOf}
            nowMinute={date === today ? nowMinute : null}
            clock={clock}
            label={(item) => labelOf(item)}
            range={range}
          />

          {!placed && timeline.gaps.length === 0 ? (
            <EmptyState icon={Moon} title={t.empty} className="border-0 py-4" />
          ) : (
            <ol aria-label={t.listLabel} className="-mx-5 divide-y border-y">
              {timeline.items.map((item) => (
                <TimelineRow
                  key={item.key}
                  item={item}
                  color={colorOf(item)}
                  range={item.kind === "sleep" ? sleepRange(item) : range(item.start, item.end)}
                  categoryName={
                    item.kind === "activity"
                      ? categoryById.get(item.activity.categoryId)?.name
                      : undefined
                  }
                  onEdit={() => item.kind === "activity" && actions.edit(item.activity)}
                  onFill={() => fill(item.start, item.end)}
                  fillLabel={t.fillGapFor(clock(item.start), clock(item.end))}
                />
              ))}
            </ol>
          )}

          {timeline.untimed.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t.untimed(timeline.untimed.length)} {timeline.untimed.map((a) => a.title).join(", ")}
            </p>
          )}
        </div>
      )}

      {actions.dialogs}
      <AlertDialog open={toFix !== null} onOpenChange={(open) => !open && setToFix(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.fixTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {toFix && fix
                ? fix.kind === "remove"
                  ? t.fixRemove(toFix.loser.title)
                  : fix.kind === "trim"
                    ? t.fixTrim(
                        toFix.loser.title,
                        formatClock(fix.startTime),
                        formatClock(fix.endTime),
                      )
                    : t.fixSplit(
                        toFix.loser.title,
                        t.range(
                          formatClock(fix.parts[0].startTime),
                          formatClock(fix.parts[0].endTime),
                        ),
                        t.range(
                          formatClock(fix.parts[1].startTime),
                          formatClock(fix.parts[1].endTime),
                        ),
                      )
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const o = toFix;
                setToFix(null);
                if (o)
                  void actions.run(() =>
                    actions.editor.fixOverlap.mutateAsync([o.loser.id, o.winner.id]),
                  );
              }}
            >
              {t.fixConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );

  function sleepRange(item: Extract<TimelineItem, { kind: "sleep" }>) {
    const { bedTime, wakeTime } = item.sleep;
    return t.range(
      bedTime ? formatClock(bedTime) : clock(item.start),
      wakeTime ? formatClock(wakeTime) : clock(item.end),
    );
  }
}

function labelOf(item: TimelineItem): string {
  if (item.kind === "activity") return item.activity.title;
  if (item.kind === "sleep") return t.sleep;
  return t.gap;
}

/** A 24-hour bar (day start → next day start). Decorative: the list below has the same content. */
function DayStrip({
  items,
  colorOf,
  nowMinute,
  clock,
  label,
  range,
}: {
  items: readonly TimelineItem[];
  colorOf: (item: TimelineItem) => string | undefined;
  nowMinute: number | null;
  clock: (minute: number) => string;
  label: (item: TimelineItem) => string;
  range: (start: number, end: number) => string;
}) {
  const pct = (m: number) => `${(m / MINUTES_PER_DAY) * 100}%`;
  const ticks = [0, 240, 480, 720, 960, 1200, 1440];
  return (
    <div aria-hidden>
      <div className="relative h-8 overflow-hidden rounded-md bg-muted">
        {items.map((item) =>
          item.kind === "gap" ? (
            <div
              key={item.key}
              title={`${label(item)} · ${range(item.start, item.end)}`}
              className="absolute inset-y-0 rounded-md border-2 border-dashed border-warning/70"
              style={{ left: pct(item.start), width: pct(item.end - item.start) }}
            />
          ) : (
            <div
              key={item.key}
              title={`${label(item)} · ${range(item.start, item.end)}`}
              className="absolute inset-y-0 border-x border-card first:rounded-l-md"
              style={{
                left: pct(item.start),
                width: pct(item.end - item.start),
                background: colorOf(item),
              }}
            />
          ),
        )}
        {nowMinute !== null && (
          <div
            title={t.now}
            className="absolute inset-y-0 w-0.5 bg-foreground"
            style={{ left: pct(nowMinute) }}
          />
        )}
      </div>
      <div className="relative mt-1 h-4 text-xs text-muted-foreground tabular-nums">
        {ticks.map((m, i) => (
          <span
            key={m}
            className={cn(
              "absolute top-0 whitespace-nowrap",
              i === 0 ? "left-0" : i === ticks.length - 1 ? "right-0" : "-translate-x-1/2",
              i % 2 === 1 && "max-sm:hidden",
            )}
            style={i === 0 || i === ticks.length - 1 ? undefined : { left: pct(m) }}
          >
            {clock(m).replace(":00", "")}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  item,
  color,
  range,
  categoryName,
  onEdit,
  onFill,
  fillLabel,
}: {
  item: TimelineItem;
  color: string | undefined;
  range: string;
  categoryName?: string;
  onEdit: () => void;
  onFill: () => void;
  fillLabel: string;
}) {
  const minutes =
    item.kind === "sleep" && item.sleep.minutes !== null
      ? item.sleep.minutes
      : item.end - item.start;

  const timeCol = (
    <span className="w-full shrink-0 text-sm whitespace-nowrap text-muted-foreground tabular-nums sm:w-40">
      {range}
    </span>
  );

  if (item.kind === "gap") {
    return (
      <li
        data-timeline="gap"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 sm:flex-nowrap"
      >
        {timeCol}
        <span
          aria-hidden
          className="w-1 self-stretch rounded-full border-l-2 border-dashed border-warning"
        />
        <span className="min-w-0 flex-1 text-sm font-medium">
          {copy.pages.today.timeline.gap}
          <span className="font-normal text-muted-foreground"> · {formatDuration(minutes)}</span>
        </span>
        <Button size="sm" variant="outline" aria-label={fillLabel} onClick={onFill}>
          <Plus aria-hidden />
          {copy.pages.today.timeline.fillGap}
        </Button>
      </li>
    );
  }

  const isSleep = item.kind === "sleep";
  const title = isSleep ? t.sleep : item.activity.title;
  const detail = isSleep
    ? item.sleep.bedTime
      ? null
      : t.sleepBedMissing
    : [categoryName, item.continued ? t.continued : null].filter(Boolean).join(" · ");

  const body = (
    <>
      <span className="block font-medium">{title}</span>
      {detail && <span className="block text-sm text-muted-foreground">{detail}</span>}
    </>
  );

  return (
    <li
      data-timeline={item.kind}
      data-title={title}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 sm:flex-nowrap"
    >
      {timeCol}
      <span aria-hidden className="w-1 self-stretch rounded-full" style={{ background: color }} />
      {isSleep ? (
        <span className="min-w-0 flex-1">{body}</span>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {body}
        </button>
      )}
      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
        {formatDuration(minutes)}
      </span>
    </li>
  );
}
