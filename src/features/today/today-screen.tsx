"use client";

import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Cell, Dashboard, Panel } from "@/components/dashboard";
import { PageHeader } from "@/components/page-header";
import { ProgressRing } from "@/components/progress-ring";
import { SegmentedControl } from "@/components/segmented-control";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import { isUnlocked } from "@/data/habit-ops";
import type { DayStatus, Habit, HabitLog, HabitTarget } from "@/data/schema";
import { TodayActivities } from "@/features/activities/today-activities";
import { phaseLabel } from "@/features/habits/format";
import { TodayHealth } from "@/features/health/today-health";
import { MetricsPanel } from "@/features/metrics/metrics-panel";
import { BackupReminder } from "@/features/settings/backup-reminder";
import { useReadiness } from "@/features/phases/use-readiness";
import { TimelinePanel } from "@/features/timeline/timeline-panel";
import { useHabitStats } from "@/features/habits/use-habit-stats";
import { useCheckIn, useCheckInNote, useSetDayStatus } from "@/hooks/use-checkins";
import {
  useDayStatuses,
  useHabitLogs,
  useHabits,
  useHabitTargets,
  usePhases,
  useSettings,
} from "@/hooks/use-data";
import { useNow, useToday } from "@/hooks/use-today";
import {
  addDays,
  dayStreak,
  eachDay,
  logicalDate,
  summarizeDay,
  weeklyCount,
  zonedParts,
  type Entry,
  type IsoDate,
} from "@/lib/core";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { CheckGroup, GROUP_ORDER, type CheckRowModel } from "./checklist";
import { dayTitle, formatLongDate, formatShort } from "./format";
import { NoteDialog } from "./note-dialog";

const t = copy.pages.today;
type DayType = DayStatus["type"];
const DAY_TYPES = (["normal", "rest", "sick", "travel"] as const).map((value) => ({
  value,
  label: t.dayType.types[value],
}));

export function TodayScreen() {
  const settings = useSettings();
  const phases = usePhases();
  const habits = useHabits();
  const targets = useHabitTargets();
  const logs = useHabitLogs();
  const dayStatuses = useDayStatuses();
  const today = useToday();
  const now = useNow();
  const { readiness, paused } = useReadiness();

  const selectedDate = useUiStore((s) => s.selectedDate);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const checkIn = useCheckIn();
  const saveNote = useCheckInNote();
  const setDayStatus = useSetDayStatus();
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<{ habit: Habit; log: HabitLog } | null>(null);

  // The day being viewed: today unless you picked an earlier day (never the future).
  const date = today && selectedDate && selectedDate < today ? selectedDate : today;

  const targetsByHabit = useMemo(() => {
    const map = new Map<string, HabitTarget[]>();
    for (const target of targets.data ?? [])
      map.set(target.habitId, [...(map.get(target.habitId) ?? []), target]);
    return map;
  }, [targets.data]);

  const logIndex = useMemo(() => {
    const map = new Map<string, Map<IsoDate, HabitLog>>();
    for (const log of logs.data ?? []) {
      if (!map.has(log.habitId)) map.set(log.habitId, new Map());
      map.get(log.habitId)!.set(log.date, log);
    }
    return map;
  }, [logs.data]);

  // Rest, sick and travel days, and days a phase was paused: they never break a streak.
  const restDates = useMemo(
    () =>
      new Set([
        ...(dayStatuses.data ?? []).filter((d) => d.type !== "normal").map((d) => d.date),
        ...paused,
      ]),
    [dayStatuses.data, paused],
  );

  /** Habits on the checklist: not archived, in an unlocked phase, in phase then list order. */
  const active = useMemo(() => {
    const phaseList = phases.data ?? [];
    const order = new Map(phaseList.map((p) => [p.id, p.number]));
    const unlocked = new Set(phaseList.filter(isUnlocked).map((p) => p.id));
    return (habits.data ?? [])
      .filter((h) => !h.archived && unlocked.has(h.phaseId))
      .sort(
        (a, b) =>
          (order.get(a.phaseId) ?? 0) - (order.get(b.phaseId) ?? 0) || a.sortOrder - b.sortOrder,
      );
  }, [phases.data, habits.data]);

  const statsInput = useMemo(
    () =>
      habits.data && logs.data && dayStatuses.data && settings.data && today
        ? {
            habits: active,
            targetsByHabit,
            logs: logs.data,
            dayStatuses: dayStatuses.data,
            settings: settings.data,
            today,
            windowDays: 14,
            pausedDates: paused,
          }
        : null,
    [
      habits.data,
      logs.data,
      dayStatuses.data,
      settings.data,
      today,
      active,
      targetsByHabit,
      paused,
    ],
  );
  const stats14 = useHabitStats(statsInput);

  const daySummary = (day: IsoDate, dayType: DayType = "normal") =>
    summarizeDay({
      date: day,
      dayType,
      dayStartHour: settings.data?.dayStartHour ?? 4,
      habits: active.map((habit) => {
        const log = logIndex.get(habit.id)?.get(day);
        return {
          habit,
          targets: targetsByHabit.get(habit.id) ?? [],
          entry: log ? { value: log.value, time: log.time } : null,
        };
      }),
    });

  /** Days in a row at or above the target (default 80%). */
  const streak = useMemo(() => {
    if (!settings.data || !today || active.length === 0) return null;
    const config = { timeZone: settings.data.timezone, dayStartHour: settings.data.dayStartHour };
    let from = today;
    for (const habit of active) {
      const created = logicalDate(new Date(habit.createdAt), config);
      if (created < from) from = created;
      for (const d of logIndex.get(habit.id)?.keys() ?? []) if (d < from) from = d;
    }
    const averages = new Map(eachDay(from, today).map((d) => [d, daySummary(d).averageProgress]));
    return dayStreak({
      averages,
      restDates,
      from,
      today,
      threshold: settings.data.unlockThreshold,
    });
    // daySummary only reads the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.data, today, active, logIndex, restDates, targetsByHabit]);

  const loaded =
    settings.data &&
    phases.data &&
    habits.data &&
    targets.data &&
    logs.data &&
    dayStatuses.data &&
    today &&
    date;

  if (settings.isError || habits.isError || logs.isError) {
    return (
      <>
        <PageHeader title={t.title} />
        <p role="alert" className="text-sm text-destructive">
          {t.loadError}
        </p>
      </>
    );
  }

  if (!loaded) {
    return (
      <>
        <PageHeader title={t.title} />
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </>
    );
  }

  const s = settings.data!;
  const isToday = date === today;
  const dayType: DayType = dayStatuses.data!.find((d) => d.date === date)?.type ?? "normal";
  const summary = daySummary(date, dayType);

  // Current time in your time zone: used for "Now", tick times and "Tonight" labels.
  const clock = isToday && now ? zonedParts(now, s.timezone) : null;
  // Compare within the logical day (4 AM → 4 AM): at 1:30 AM it's still "night", not "before tonight".
  const nowInDay = clock
    ? (clock.hour * 60 + clock.minute - s.dayStartHour * 60 + 1440) % 1440
    : null;
  const NIGHT_STARTS = (20 - s.dayStartHour) * 60;
  const EVENING_STARTS = (17 - s.dayStartHour) * 60;
  const nowTime = clock
    ? `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`
    : null;

  const rows: CheckRowModel[] = [];
  const notDue: Habit[] = [];
  for (const item of summary.items) {
    const habit = active.find((h) => h.id === item.habitId)!;
    if (item.role === "not-due") {
      notDue.push(habit);
      continue;
    }
    const habitLogs = logIndex.get(habit.id);
    const schedule = habit.schedule;
    rows.push({
      habit,
      target: item.target,
      log: habitLogs?.get(date),
      score: item.score,
      streak: stats14.get(habit.id)?.streak,
      weekly:
        schedule.kind === "timesPerWeek"
          ? {
              done: weeklyCount(
                new Set([...(habitLogs?.values() ?? [])].filter((l) => l.done).map((l) => l.date)),
                date,
                s.weekStart,
              ),
              times: schedule.times,
            }
          : undefined,
      later:
        nowInDay !== null && habit.partOfDay === "night" && nowInDay < NIGHT_STARTS
          ? "night"
          : nowInDay !== null && habit.partOfDay === "evening" && nowInDay < EVENING_STARTS
            ? "evening"
            : null,
    });
  }

  const counted = summary.countedCount;
  const done = summary.doneCount;
  const left = Math.max(0, counted - done);
  // In checklist order, so "Next:" names what comes up first in the day.
  const leftNames = GROUP_ORDER.flatMap((part) =>
    rows.filter(
      (r) =>
        r.habit.partOfDay === part && !r.score.done && r.habit.schedule.kind !== "timesPerWeek",
    ),
  ).map((r) => r.habit.name);

  // The unlock rule's numbers (the same ones the Phases screen shows).
  const phaseAverage = readiness?.average != null ? Math.round(readiness.average) : null;
  const phaseReady = readiness?.state === "ready" && !!readiness.next;
  const activePhases = (phases.data ?? []).filter((p) => p.status === "active");

  const log = (habit: Habit, entry: Entry | null) => {
    setError(null);
    checkIn.mutate(
      { habit, targets: targetsByHabit.get(habit.id) ?? [], date, entry },
      { onError: (e) => setError(e instanceof Error ? e.message : String(e)) },
    );
  };

  const goTo = (d: IsoDate) => setSelectedDate(d >= today! ? null : d);

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(date)}
        title={dayTitle(date, today!, { today: t.title, yesterday: t.yesterday })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activePhases.map((p) => (
              <Badge key={p.id} variant="secondary" className="h-7 px-3">
                {phaseLabel(p)}
              </Badge>
            ))}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label={t.nav.previous}
                onClick={() => goTo(addDays(date, -1))}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <Input
                type="date"
                aria-label={t.nav.pick}
                value={date}
                max={today!}
                onChange={(e) => e.target.value && goTo(e.target.value)}
                className="h-8 w-40"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label={t.nav.next}
                disabled={isToday}
                onClick={() => goTo(addDays(date, 1))}
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
            {!isToday && (
              <Button variant="secondary" size="sm" onClick={() => setSelectedDate(null)}>
                {t.nav.backToToday}
              </Button>
            )}
          </div>
        }
      />

      <div aria-live="polite">
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>

      <Dashboard>
        {isToday && (
          <Cell span={12} fullOnTablet className="empty:hidden">
            <BackupReminder />
          </Cell>
        )}
        <Cell span={12} fullOnTablet>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-5">
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <ProgressRing
                percent={summary.averageProgress ?? 0}
                label={counted ? `${done}/${counted}` : "—"}
                ariaLabel={counted ? t.tiles.doneNote(done, counted) : t.tiles.nothingDue}
              />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t.tiles.done}</p>
                <p className="font-heading text-lg font-semibold">
                  {counted ? t.tiles.doneValue(done, counted) : t.tiles.nothingDue}
                </p>
              </div>
            </div>
            <StatTile
              label={t.tiles.streak}
              value={copy.pages.habits.streakValue(streak?.current ?? 0, "days")}
              note={t.tiles.streakNote(s.unlockThreshold)}
              tone={streak && streak.current > 0 ? "positive" : "neutral"}
            />
            <div className="rounded-xl border bg-card p-4" data-testid="phase-tile">
              <p className="text-sm text-muted-foreground">{t.tiles.phase}</p>
              <p className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                {phaseAverage !== null ? `${phaseAverage}%` : copy.pages.habits.kpi.none}
              </p>
              <div
                className="relative mt-2 h-2 rounded-full bg-muted"
                role="img"
                aria-label={t.tiles.phaseNote(s.unlockThreshold)}
              >
                <div
                  className={cn("h-full rounded-full", phaseReady ? "bg-success" : "bg-primary")}
                  style={{ width: `${Math.min(100, phaseAverage ?? 0)}%` }}
                />
                <div
                  aria-hidden
                  className="absolute -top-1 h-4 w-0.5 rounded bg-foreground"
                  style={{ left: `${s.unlockThreshold}%` }}
                />
              </div>
              <p
                className={cn(
                  "mt-2 text-sm",
                  phaseReady ? "font-medium text-success" : "text-muted-foreground",
                )}
              >
                {phaseReady && readiness?.next
                  ? t.tiles.phaseReady(phaseLabel(readiness.next))
                  : readiness?.state === "paused"
                    ? t.tiles.phasePaused
                    : readiness?.phase
                      ? t.tiles.phaseDay(
                          readiness.dayNumber,
                          readiness.rules.windowDays,
                          s.unlockThreshold,
                        )
                      : t.tiles.phaseEmpty}
              </p>
            </div>
            <StatTile
              label={isToday ? t.tiles.leftBeforeBed : t.tiles.left}
              value={String(left)}
              note={
                left === 0 && counted > 0
                  ? t.tiles.allDone
                  : !isToday
                    ? t.tiles.leftPast
                    : leftNames.length
                      ? t.tiles.nextUp(leftNames.slice(0, 2), leftNames.length - 2)
                      : undefined
              }
              tone={left === 0 && counted > 0 ? "positive" : "neutral"}
            />
          </div>
        </Cell>

        {phaseReady && isToday && readiness?.next && (
          <Cell span={12} fullOnTablet>
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/40 bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                <div>
                  <p className="font-medium">{t.ready.title(phaseLabel(readiness.next))}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.ready.body(phaseAverage ?? 0, readiness.rules.windowDays)}
                  </p>
                </div>
              </div>
              <Button size="sm" render={<Link href="/phases" />}>
                {t.ready.open}
              </Button>
            </div>
          </Cell>
        )}

        {dayType !== "normal" && (
          <Cell span={12} fullOnTablet>
            <p className="rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">
              {t.dayType.banner(t.dayType.types[dayType])}
            </p>
          </Cell>
        )}

        <Panel
          span={8}
          title={t.checklist.title}
          subtitle={t.checklist.subtitle}
          className="overflow-hidden"
          bodyClassName="-mx-5 -mb-5 border-t"
        >
          {rows.length === 0 && notDue.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">{t.checklist.empty}</p>
          ) : (
            GROUP_ORDER.map((part) => {
              const groupRows = rows.filter((r) => r.habit.partOfDay === part);
              return groupRows.length ? (
                <CheckGroup
                  key={part}
                  part={part}
                  rows={groupRows}
                  onLog={log}
                  onNote={(habit, l) => setNoteFor({ habit, log: l })}
                  nowTime={nowTime}
                  dayStartHour={s.dayStartHour}
                />
              ) : null;
            })
          )}
          {notDue.length > 0 && (
            <details className="border-t px-4 py-3 text-sm text-muted-foreground">
              <summary className="cursor-pointer">{t.checklist.notDue(notDue.length)}</summary>
              <ul className="mt-2 list-disc pl-5">
                {notDue.map((h) => {
                  const pause = h.pauses.find((p) => p.from <= date && date <= p.to);
                  return (
                    <li key={h.id}>
                      {h.name}
                      {pause && ` · ${t.checklist.pausedUntil(formatShort(pause.to))}`}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </Panel>

        <Cell span={4} className="flex flex-col gap-4 md:col-span-2 xl:col-span-4">
          <Panel title={t.dayType.title} subtitle={t.dayType.hint}>
            <SegmentedControl<DayType>
              label={t.dayType.title}
              options={DAY_TYPES}
              value={dayType}
              onChange={(type) => setDayStatus.mutate({ date, type })}
              className="flex w-full [&>button]:flex-1 [&>button]:px-2"
            />
          </Panel>
          <TodayActivities date={date} today={today!} />
          <TodayHealth date={date} />
        </Cell>

        <MetricsPanel span={4} date={date} habits={active} units={s.units} />
        <TimelinePanel
          span={8}
          date={date}
          today={today!}
          dayStartHour={s.dayStartHour}
          nowMinute={nowInDay}
          habits={habits.data!}
          targetsByHabit={targetsByHabit}
        />
      </Dashboard>

      {noteFor && (
        <NoteDialog
          habitName={noteFor.habit.name}
          initial={noteFor.log.note}
          onSave={(note) => saveNote.mutateAsync({ habitId: noteFor.habit.id, date, note })}
          onClose={() => setNoteFor(null)}
        />
      )}
    </>
  );
}
