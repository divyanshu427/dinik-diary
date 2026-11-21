"use client";

import {
  CalendarClock,
  Layers,
  Lock,
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionMenu } from "@/components/action-menu";
import { useMemo, useState } from "react";
import { Cell, Dashboard, Panel } from "@/components/dashboard";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import type { Habit, HabitTarget, Phase, TargetUpgrade } from "@/data/schema";
import { describeTarget } from "@/features/habits/format";
import { PhaseFormDialog } from "@/features/habits/phase-form-dialog";
import { phaseLabel } from "@/features/habits/format";
import { useHabits, useHabitTargets, usePhases, useSettings } from "@/hooks/use-data";
import { useHabitEditor } from "@/hooks/use-habit-editor";
import { parseIsoDate, targetOn, type IsoDate, type PhaseReadiness } from "@/lib/core";
import { cn } from "@/lib/utils";
import { UpgradeDialog } from "./upgrade-dialog";
import { useReadiness } from "./use-readiness";
import { WindowChart } from "./window-chart";

const t = copy.pages.phases;
const statusLabel = copy.pages.data.phaseStatus;

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const fmt = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return shortDate.format(new Date(year, month - 1, day));
};

type Confirm =
  | { kind: "enable"; phase: Phase; early: boolean }
  | { kind: "repeat"; phase: Phase }
  | { kind: "off"; phase: Phase }
  | null;

/** The phase manager (Build Phase 11). Reference: the Phases mock-up. */
export function PhasesScreen() {
  const phases = usePhases();
  const habits = useHabits();
  const targets = useHabitTargets();
  const settings = useSettings();
  const editor = useHabitEditor();
  const { readiness } = useReadiness();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [addingPhase, setAddingPhase] = useState(false);
  const [upgradeFor, setUpgradeFor] = useState<Phase | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetsByHabit = useMemo(() => {
    const map = new Map<string, HabitTarget[]>();
    for (const target of targets.data ?? [])
      map.set(target.habitId, [...(map.get(target.habitId) ?? []), target]);
    return map;
  }, [targets.data]);

  if (phases.isError || habits.isError) {
    return (
      <>
        <PageHeader title={t.title} />
        <p role="alert" className="text-sm text-destructive">
          {t.loadError}
        </p>
      </>
    );
  }
  if (!phases.data || !habits.data || !settings.data || !readiness || !editor.today) {
    return (
      <>
        <PageHeader title={t.title} />
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </>
    );
  }

  const today = editor.today;
  const all = phases.data;
  const habitById = new Map(habits.data.map((h) => [h.id, h]));
  const habitsOf = (p: Phase) =>
    habits
      .data!.filter((h) => h.phaseId === p.id && !h.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  const onChecklist = habits.data.filter(
    (h) => !h.archived && all.some((p) => p.id === h.phaseId && p.status !== "locked"),
  ).length;
  const current = readiness.phase;
  const others = all.filter((p) => p.id !== current?.id);
  const upNext = others.filter((p) => p.status === "locked");
  const done = others.filter((p) => p.status !== "locked");

  const run = (work: Promise<unknown>) => {
    setError(null);
    work.catch((e) => setError(t.failed(e instanceof Error ? e.message : String(e))));
  };

  const upgradeText = (u: TargetUpgrade) => {
    const habit = habitById.get(u.habitId);
    if (!habit) return null;
    return t.card.upgrade(
      habit.name,
      describeTarget(habit, targetOn(targetsByHabit.get(habit.id) ?? [], today)),
      describeTarget(habit, u),
    );
  };

  const history = all
    .flatMap((p) => p.history.map((e, i) => ({ phase: p, event: e, key: `${p.id}-${i}` })))
    .sort((a, b) => b.event.date.localeCompare(a.event.date) || b.phase.number - a.phase.number);

  const eyebrow = current
    ? t.eyebrow(phaseLabel(current), readiness.dayNumber, readiness.rules.windowDays)
    : t.eyebrowNone;

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        inlineActions
        actions={
          <Button variant="outline" onClick={() => setAddingPhase(true)} aria-label={t.addPhase}>
            <Plus aria-hidden />
            <span className="max-sm:hidden">{t.addPhase}</span>
            <span className="sm:hidden">{t.addPhaseShort}</span>
          </Button>
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

      {/* Phones: both columns melt into one list, in the mock-up's order (see `order-*`). */}
      <Dashboard>
        <Cell span={8} fullOnTablet className="flex flex-col gap-4 max-md:contents xl:gap-5">
          <div className="max-md:order-1">
            {current ? (
              <ActivePhaseCard
                phase={current}
                readiness={readiness}
                habitCount={onChecklist}
                name={(id) => habitById.get(id)?.name ?? "?"}
                onEnableNext={(early) =>
                  readiness.next && setConfirm({ kind: "enable", phase: readiness.next, early })
                }
                onRepeat={() => setConfirm({ kind: "repeat", phase: current })}
                onPause={() => run(editor.pausePhase.mutateAsync([current.id]))}
                onResume={() => run(editor.resumePhase.mutateAsync([current.id]))}
                onTurnOff={() => setConfirm({ kind: "off", phase: current })}
              />
            ) : (
              <EmptyState icon={Layers} title={t.noPhase.title} body={t.noPhase.body}>
                {readiness.next && (
                  <Button
                    onClick={() =>
                      setConfirm({ kind: "enable", phase: readiness.next!, early: false })
                    }
                  >
                    {t.active.enable(phaseLabel(readiness.next))}
                  </Button>
                )}
              </EmptyState>
            )}
          </div>

          {[
            { title: t.upNext, list: upNext, order: "max-md:order-3" },
            { title: t.completed, list: done, order: "max-md:order-4" },
          ].map(
            ({ title, list, order }) =>
              list.length > 0 && (
                <section key={title} aria-label={title} className={order}>
                  <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {title}
                  </h2>
                  <ul className="grid gap-4 sm:grid-cols-2 xl:gap-5 2xl:grid-cols-3">
                    {list.map((p) => (
                      <PhaseCard
                        key={p.id}
                        phase={p}
                        habits={habitsOf(p)}
                        isNext={readiness.next?.id === p.id}
                        upgrades={p.targetUpgrades.map(upgradeText)}
                        onEnable={() =>
                          setConfirm({
                            kind: "enable",
                            phase: p,
                            early:
                              !(readiness.state === "ready" && readiness.next?.id === p.id) &&
                              !!current,
                          })
                        }
                        onAddUpgrade={() => setUpgradeFor(p)}
                        onRemoveUpgrade={(habitId) =>
                          run(
                            editor.setTargetUpgrades.mutateAsync([
                              p.id,
                              p.targetUpgrades.filter((u) => u.habitId !== habitId),
                            ]),
                          )
                        }
                        habitName={(id) => habitById.get(id)?.name ?? "?"}
                        completedOn={
                          [...p.history].reverse().find((e) => e.kind === "completed")?.date
                        }
                      />
                    ))}
                  </ul>
                </section>
              ),
          )}

          {/* Phones have the "Custom phase" button in the header instead. */}
          <button
            type="button"
            onClick={() => setAddingPhase(true)}
            className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card p-5 text-center outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 max-md:hidden"
          >
            <Plus aria-hidden className="size-5 text-primary" />
            <span className="font-medium">{t.addPhase}</span>
            <span className="text-sm text-muted-foreground">{t.addPhaseHint}</span>
          </button>
        </Cell>

        <Cell
          span={4}
          className="flex flex-col gap-4 max-md:contents md:col-span-2 xl:col-span-4 xl:gap-5"
        >
          <Panel
            className="max-md:order-2"
            title={t.chart.title}
            subtitle={t.chart.subtitle(readiness.rules.windowDays, readiness.rules.threshold)}
          >
            <WindowChart days={readiness.days} threshold={readiness.rules.threshold} />
          </Panel>
          <Panel className="max-md:order-5" title={t.rules.title}>
            <div id="how-phases-unlock" className="scroll-mt-28" />
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
              {t.rules
                .items(
                  readiness.rules.threshold,
                  readiness.rules.windowDays,
                  readiness.rules.minLoggedDays,
                )
                .map((item) => (
                  <li key={item}>{item}</li>
                ))}
            </ul>
            <Link
              href="/settings"
              className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t.rules.change}
            </Link>
          </Panel>
          <Panel className="max-md:order-6" title={t.history.title}>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.history.empty}</p>
            ) : (
              <ol className="flex flex-col gap-2 text-sm" data-testid="phase-history">
                {history.slice(0, 12).map(({ phase, event, key }) => (
                  <li key={key} className="flex gap-3">
                    <span className="w-14 shrink-0 text-muted-foreground tabular-nums">
                      {fmt(event.date)}
                    </span>
                    <span>
                      {event.kind === "started"
                        ? t.history.event.started(phaseLabel(phase), !!event.early)
                        : t.history.event[event.kind](phaseLabel(phase))}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </Cell>
      </Dashboard>

      {confirm && (
        <ConfirmDialog
          confirm={confirm}
          habitCount={confirm.kind === "enable" ? habitsOf(confirm.phase).length : 0}
          upgrades={
            confirm.kind === "enable"
              ? confirm.phase.targetUpgrades.map(upgradeText).filter((x): x is string => !!x)
              : []
          }
          readiness={readiness}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const c = confirm;
            setConfirm(null);
            if (c.kind === "enable")
              run(editor.enablePhase.mutateAsync([c.phase.id, { early: c.early }]));
            else if (c.kind === "repeat") run(editor.repeatPhase.mutateAsync([c.phase.id]));
            else run(editor.lockPhase.mutateAsync([c.phase.id]));
          }}
        />
      )}

      {addingPhase && (
        <PhaseFormDialog
          mode="create"
          initial={{ name: "", description: "" }}
          onSubmit={(draft) => editor.createPhase.mutateAsync([draft])}
          onClose={() => setAddingPhase(false)}
        />
      )}

      {upgradeFor && (
        <UpgradeDialog
          phaseLabel={phaseLabel(upgradeFor)}
          habits={habits.data.filter(
            (h) => !h.archived && h.phaseId !== upgradeFor.id && h.type !== "boolean",
          )}
          targetsByHabit={targetsByHabit}
          today={today}
          onSubmit={(upgrade) =>
            editor.setTargetUpgrades.mutateAsync([
              upgradeFor.id,
              [...upgradeFor.targetUpgrades.filter((u) => u.habitId !== upgrade.habitId), upgrade],
            ])
          }
          onClose={() => setUpgradeFor(null)}
        />
      )}
    </>
  );
}

// ---------- the current phase ----------

function ActivePhaseCard({
  phase,
  readiness: r,
  habitCount,
  name,
  onEnableNext,
  onRepeat,
  onPause,
  onResume,
  onTurnOff,
}: {
  phase: Phase;
  readiness: PhaseReadiness;
  habitCount: number;
  name: (habitId: string) => string;
  onEnableNext: (early: boolean) => void;
  onRepeat: () => void;
  onPause: () => void;
  onResume: () => void;
  onTurnOff: () => void;
}) {
  const a = t.active;
  const { threshold, windowDays, minLoggedDays } = r.rules;
  const avg = r.average === null ? null : Math.round(r.average);
  const paused = phase.status === "paused";
  const pausedOn = [...phase.history].reverse().find((e) => e.kind === "paused")?.date;
  const ready = r.state === "ready";
  const router = useRouter();

  const message =
    r.state === "in-progress"
      ? a.states["in-progress"](windowDays - r.judgedDays)
      : r.state === "too-few-logged"
        ? a.states["too-few-logged"](r.loggedDays, minLoggedDays)
        : r.state === "below-target"
          ? a.states["below-target"](avg ?? 0, threshold)
          : r.state === "ready"
            ? r.next
              ? a.states.ready(phaseLabel(r.next))
              : a.states.readyLast
            : r.state === "paused"
              ? a.states.paused
              : "";

  const windowDone = r.state === "below-target" || r.state === "too-few-logged";
  const short = avg === null ? 0 : Math.max(0, threshold - avg);
  const tone = ready
    ? "border-success/40 bg-success/10 text-foreground"
    : windowDone
      ? "border-warning/40 bg-warning/10 text-foreground"
      : "border-border bg-muted/50 text-muted-foreground";

  const strengths = (
    title: string,
    list: PhaseReadiness["strongest"],
    testId: string,
    weak?: boolean,
  ) => (
    <div>
      <h3 className={cn("mb-2 text-sm font-semibold", weak && "text-warning")}>{title}</h3>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{a.notYet}</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm" data-testid={testId}>
          {list.map((h) => (
            <li key={h.habitId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{name(h.habitId)}</span>
              <span className={cn("shrink-0 font-semibold tabular-nums", weak && "text-warning")}>
                {Math.round(h.percent)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // The main next step gets the filled button: enable when ready, repeat when the window
  // ended short, otherwise nothing is urgent.
  const enableButton = r.next && (
    <Button
      variant={ready ? "default" : "outline"}
      onClick={() => onEnableNext(!ready)}
      className="h-auto min-h-9 max-w-full py-2 whitespace-normal max-sm:min-h-12 max-sm:w-full max-sm:text-base"
    >
      <Layers aria-hidden />
      {ready ? a.enable(phaseLabel(r.next)) : a.enableEarly(phaseLabel(r.next))}
    </Button>
  );
  const repeatButton = (
    <Button
      variant={windowDone ? "default" : "outline"}
      onClick={onRepeat}
      className="max-sm:h-12 max-sm:w-full max-sm:text-base"
    >
      <RotateCcw aria-hidden />
      {a.repeat}
    </Button>
  );

  return (
    <section
      aria-labelledby="current-phase-title"
      className="rounded-2xl border-2 border-primary/70 bg-card p-5 text-card-foreground"
      data-testid="current-phase"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{a.title}</p>
        <div className="flex items-center gap-2">
          <Badge variant={paused ? "secondary" : "default"}>{statusLabel[phase.status]}</Badge>
          <Badge variant="outline" className="tabular-nums">
            <CalendarClock aria-hidden />
            {a.day(r.dayNumber, windowDays)}
          </Badge>
        </div>
      </div>
      <h2 id="current-phase-title" className="mt-1 font-heading text-xl font-semibold">
        {phaseLabel(phase)}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {paused && pausedOn
          ? a.pausedSince(fmt(pausedOn))
          : a.since(fmt(r.cycleStart ?? phase.history[0]?.date ?? ""), habitCount)}
      </p>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm whitespace-nowrap text-muted-foreground">
              {a.progressLabel(windowDays)}
            </p>
            <p
              className="font-heading text-4xl font-semibold tracking-tight tabular-nums"
              data-testid="phase-average"
            >
              {avg === null ? a.noAverage : `${avg}%`}
            </p>
          </div>
          <p className="pb-1 text-right text-sm text-muted-foreground">
            <span className="block font-medium text-foreground">{a.loggedDays(r.loggedDays)}</span>
            <span className="block">{a.needed(minLoggedDays, threshold)}</span>
          </p>
        </div>
        <div
          className="relative mt-2 h-3 rounded-full bg-muted"
          role="img"
          aria-label={a.barLabel(avg ?? 0, threshold)}
        >
          <div
            className={cn("h-full rounded-full", ready ? "bg-success" : "bg-primary")}
            style={{ width: `${Math.min(100, avg ?? 0)}%` }}
          />
          <div
            aria-hidden
            className="absolute -top-1 h-5 w-0.5 rounded bg-foreground"
            style={{ left: `${threshold}%` }}
          />
        </div>
        <div aria-hidden className="relative mt-1 h-4 text-xs text-muted-foreground tabular-nums">
          <span className="absolute left-0">{a.scale(threshold)[0]}</span>
          <span
            className="absolute -translate-x-1/2 font-medium text-foreground"
            style={{ left: `${threshold}%` }}
          >
            {a.scale(threshold)[1]}
          </span>
          <span className="absolute right-0">{a.scale(threshold)[2]}</span>
        </div>

        {message && (
          <div
            className={cn("mt-4 rounded-xl border px-4 py-3 text-sm", tone)}
            data-testid="phase-message"
          >
            {r.state === "below-target" && avg !== null ? (
              <>
                <p className="font-semibold">{a.belowTitle(windowDays, avg, short)}</p>
                <p className="mt-0.5">{a.belowBody}</p>
              </>
            ) : (
              <p className={cn("flex items-start gap-2", ready && "font-semibold text-success")}>
                {ready && <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />}
                {message}
              </p>
            )}
            <a
              href="#how-phases-unlock"
              className="mt-1 inline-block font-medium text-primary underline underline-offset-4"
            >
              {a.howItWorks}
            </a>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {windowDone ? (
          <>
            {repeatButton}
            {enableButton}
          </>
        ) : (
          <>
            {enableButton}
            {repeatButton}
          </>
        )}
        <div className="flex items-center gap-2 max-sm:w-full">
          {paused ? (
            <Button variant="outline" onClick={onResume} className="max-sm:h-11 max-sm:flex-1">
              <Play aria-hidden />
              {a.resume}
            </Button>
          ) : (
            <Button variant="outline" onClick={onPause} className="max-sm:h-11 max-sm:flex-1">
              <Pause aria-hidden />
              {a.pause}
            </Button>
          )}
          <ActionMenu
            label={a.more}
            title={phaseLabel(phase)}
            triggerClassName="size-9 border max-sm:size-11"
            items={[
              {
                label: a.editHabits,
                description: a.editHabitsHint,
                icon: Pencil,
                onSelect: () => router.push("/habits"),
              },
              {
                label: a.turnOff,
                description: a.turnOffHint,
                icon: Power,
                destructive: true,
                separatorBefore: true,
                onSelect: onTurnOff,
              },
            ]}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 border-t pt-4 sm:grid-cols-2">
        {strengths(a.strongest, r.strongest, "strongest")}
        {strengths(a.weakest, r.weakest, "weakest", true)}
      </div>
    </section>
  );
}

// ---------- other phases ----------

function PhaseCard({
  phase,
  habits,
  isNext,
  upgrades,
  onEnable,
  onAddUpgrade,
  onRemoveUpgrade,
  habitName,
  completedOn,
}: {
  phase: Phase;
  habits: readonly Habit[];
  isNext: boolean;
  /** One line per target upgrade (null when its habit is gone). */
  upgrades: (string | null)[];
  onEnable: () => void;
  onAddUpgrade: () => void;
  onRemoveUpgrade: (habitId: string) => void;
  habitName: (id: string) => string;
  completedOn?: IsoDate;
}) {
  const c = t.card;
  const locked = phase.status === "locked";
  const shown = habits.slice(0, 3);
  const titleId = `phase-card-${phase.id}`;
  return (
    <li>
      <section
        aria-labelledby={titleId}
        data-phase={phase.name}
        className="flex h-full flex-col rounded-2xl border bg-card p-5 text-card-foreground"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} className="font-heading text-lg font-semibold">
            {phaseLabel(phase)}
          </h2>
          <Badge variant={locked ? "secondary" : "outline"} className="shrink-0">
            {locked && <Lock aria-hidden />}
            {statusLabel[phase.status]}
          </Badge>
        </div>
        {phase.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{phase.description}</p>
        )}
        {phase.status === "completed" && completedOn && (
          <p className="mt-1 text-sm text-muted-foreground">{c.completedOn(fmt(completedOn))}</p>
        )}

        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {habits.length === 0 && <li className="text-muted-foreground">{c.noHabits}</li>}
          {shown.map((h) => (
            <li key={h.id} className="truncate">
              {h.name}
            </li>
          ))}
          {habits.length > shown.length && (
            <li className="font-medium text-primary">{c.more(habits.length - shown.length)}</li>
          )}
        </ul>

        {locked && upgrades.some(Boolean) && (
          <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
              {c.upgrades}
            </p>
            <ul className="flex flex-col gap-1" data-testid="upgrades">
              {phase.targetUpgrades.map((u, i) =>
                upgrades[i] ? (
                  <li key={u.habitId} className="flex items-center justify-between gap-2">
                    <span>{upgrades[i]}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={c.removeUpgrade(habitName(u.habitId))}
                      onClick={() => onRemoveUpgrade(u.habitId)}
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        )}

        {locked && (
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <Button variant="outline" onClick={onAddUpgrade} className="h-auto min-h-10 py-2">
              <Plus aria-hidden />
              {c.addUpgrade}
            </Button>
            <Button
              variant="outline"
              onClick={onEnable}
              className={cn(
                "h-auto min-h-10 py-2",
                isNext ? "border-primary bg-accent text-primary" : "border-primary/60 text-primary",
              )}
            >
              {isNext ? c.enable : c.enableEarly}
            </Button>
          </div>
        )}
      </section>
    </li>
  );
}

// ---------- confirmations ----------

function ConfirmDialog({
  confirm,
  habitCount,
  upgrades,
  readiness,
  onCancel,
  onConfirm,
}: {
  confirm: NonNullable<Confirm>;
  habitCount: number;
  upgrades: string[];
  readiness: PhaseReadiness;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const c = t.confirm;
  const label = phaseLabel(confirm.phase);
  const title =
    confirm.kind === "enable"
      ? c.enableTitle(label)
      : confirm.kind === "repeat"
        ? c.repeatTitle
        : c.offTitle(label);
  const action =
    confirm.kind === "enable" ? c.enable : confirm.kind === "repeat" ? c.repeat : c.off;
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            {confirm.kind === "enable" ? (
              <div className="flex flex-col gap-2">
                <p>{c.enableBody(habitCount)}</p>
                {confirm.early && <p>{c.earlyNote(readiness.rules.threshold)}</p>}
                {upgrades.length > 0 && (
                  <>
                    <p className="font-medium text-foreground">{c.changes}</p>
                    <ul className="list-disc pl-5">
                      {upgrades.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : confirm.kind === "repeat" ? (
              <p>{c.repeatBody(readiness.rules.windowDays)}</p>
            ) : (
              <p>{c.offBody}</p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{c.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant={confirm.kind === "off" ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
