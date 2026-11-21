"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronRight,
  CircleSlash,
  ChevronsUpDown,
  EllipsisVertical,
  FileText,
  FolderInput,
  GripVertical,
  Lock,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import type { CSSProperties } from "react";
import { ActionMenu, type ActionItem } from "@/components/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { isUnlocked } from "@/data/habit-ops";
import type { Category, Habit, HabitTarget, Phase } from "@/data/schema";
import { formatShort } from "@/features/today/format";
import { addDays, diffDays, isPausedOn, startState, targetOn, type HabitStats } from "@/lib/core";
import { cn } from "@/lib/utils";
import { describeSchedule, describeTarget, phaseLabel } from "./format";
import { HistoryDots } from "./history-views";

const t = copy.pages.habits;
export { phaseLabel };
export const containerId = (phaseId: string) => `phase:${phaseId}`;

export interface HabitRowHandlers {
  onEditHabit: (habit: Habit) => void;
  onPauseHabit: (habit: Habit, days: number) => void;
  onResumeHabit: (habit: Habit) => void;
  onMoveHabit: (habit: Habit, direction: "up" | "down") => void;
  onMoveHabitTo: (habit: Habit, phaseId: string) => void;
  onArchiveHabit: (habit: Habit) => void;
  onDeleteHabit: (habit: Habit) => void;
  /** Start date: a day, or null for "not started yet". */
  onSetStart: (habit: Habit, startsOn: string | null) => void;
  /** Opens "When should … start?" with a date picker. */
  onPickStart: (habit: Habit) => void;
}

interface RowContext {
  allPhases: readonly Phase[];
  targetsByHabit: Map<string, HabitTarget[]>;
  categoryById: Map<string, Category>;
  today: string;
}

/** Stats and selection for the table columns. */
interface RowStats {
  /** 14-day stats per habit id. */
  stats: Map<string, HabitStats>;
  selectedId: string | null;
  /** The active habit with the lowest 14-day %, highlighted in amber. */
  weakestId: string | null;
  onSelectHabit: (habit: Habit) => void;
  /** A filter is on: the list is partial, so dragging is switched off. */
  dragDisabled: boolean;
}

/** While a habit is being dragged: whether it's over this phase, and whether it may drop here. */
export type DropState = "none" | "allowed" | "blocked";

interface PhaseSectionProps extends HabitRowHandlers, RowContext, RowStats {
  phase: Phase;
  /** Habits to show (after filtering). */
  habits: Habit[];
  /** All visible habits in the phase, before filtering. */
  totalCount: number;
  /** How many of them have started (the rest wait). */
  startedCount: number;
  /** The current phase's progress, e.g. "Day 9 of 14 · 76%". */
  progressNote?: string;
  open: boolean;
  dropState: DropState;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  /** Phones: drag handles show only while reordering this phase (from its menu). */
  reordering: boolean;
  onReorder: (on: boolean) => void;
  onAddHabit: () => void;
  onEditPhase: () => void;
  onMovePhase: (direction: "up" | "down") => void;
  onDeletePhase: () => void;
}

/** One phase: a header you click to expand, and its habits, which can be dragged. */
export function PhaseSection(props: PhaseSectionProps) {
  const { phase, habits, open, dropState, today } = props;
  // Habits that count now, and those waiting to start (later, or not started yet).
  const started = habits.filter((h) => startState(h.startsOn, today) === "started");
  const waiting = habits.filter((h) => startState(h.startsOn, today) !== "started");
  const { setNodeRef } = useDroppable({ id: containerId(phase.id) });
  const labelId = `phase-label-${phase.id}`;
  const listId = `phase-list-${phase.id}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={labelId}
      data-tour={props.isFirst ? "habits-phase" : undefined}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card text-card-foreground transition-shadow",
        dropState === "allowed" && "ring-2 ring-primary",
        dropState === "blocked" && "ring-2 ring-destructive",
      )}
    >
      <header className="flex items-start gap-1 py-1.5 pr-2 pl-1.5 sm:items-center">
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={props.onToggle}
            className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-90",
              )}
            />
            <span className="min-w-0">
              <span id={labelId} className="block font-heading text-lg font-semibold">
                {phaseLabel(phase)}
              </span>
              {/* Phones: count and status under the name. */}
              <span className="mt-0.5 flex items-center gap-2 text-sm font-normal text-muted-foreground sm:hidden">
                {props.startedCount < props.totalCount
                  ? copy.pages.start.phaseCount(props.startedCount, props.totalCount)
                  : t.habitCount(props.totalCount)}
                <StatusBadge phase={phase} />
              </span>
              {phase.description && (
                <span
                  className={cn(
                    "block text-sm font-normal text-muted-foreground max-sm:mt-1",
                    !open && "line-clamp-1 max-sm:hidden",
                  )}
                >
                  {phase.description}
                </span>
              )}
            </span>
          </button>
        </h2>
        {props.progressNote && (
          <span
            className="hidden shrink-0 text-xs font-medium text-primary tabular-nums sm:inline"
            data-testid="phase-progress"
          >
            {props.progressNote}
          </span>
        )}
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {props.startedCount < props.totalCount
            ? copy.pages.start.phaseCount(props.startedCount, props.totalCount)
            : t.habitCount(props.totalCount)}
        </span>
        <StatusBadge phase={phase} className="hidden sm:inline-flex" />
        {props.reordering && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-1.5 sm:mt-0"
            aria-label={t.phaseActions.reorderDoneLabel(phase.name)}
            onClick={() => props.onReorder(false)}
          >
            {t.phaseActions.reorderDone}
          </Button>
        )}
        <ActionMenu
          label={t.phaseActions.more(phase.name)}
          title={phaseLabel(phase)}
          subtitle={
            <span className="flex items-center gap-2">
              {t.habitCount(props.totalCount)}
              <StatusBadge phase={phase} />
            </span>
          }
          triggerClassName="mt-1.5 sm:mt-0"
          items={phaseItems(props)}
        />
      </header>

      {dropState !== "none" && !open && (
        <p
          className={cn(
            "border-t px-4 py-2 text-sm font-medium",
            dropState === "allowed" ? "text-primary" : "text-destructive",
          )}
        >
          {dropState === "allowed" ? t.dropHere : t.cantDropHere}
        </p>
      )}

      {open && (
        <div id={listId} className="border-t">
          <SortableContext items={started.map((h) => h.id)} strategy={verticalListSortingStrategy}>
            {habits.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                {dropState === "blocked"
                  ? t.cantDropHere
                  : props.totalCount > 0
                    ? t.filters.noMatch
                    : t.emptyPhase}
              </p>
            ) : (
              <>
                {started.length > 0 && <ColumnHeader />}
                <ul className="divide-y">
                  {started.map((habit, i) => (
                    <SortableHabitRow
                      key={habit.id}
                      {...props}
                      habit={habit}
                      isFirstHabit={i === 0}
                      isLastHabit={i === started.length - 1}
                    />
                  ))}
                </ul>
              </>
            )}
          </SortableContext>
          {waiting.length > 0 && (
            <details open className="group/waiting border-t" data-testid="waiting-habits">
              <summary className="flex cursor-pointer list-none items-center gap-2 bg-muted/50 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none focus-visible:bg-muted [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden
                  className="size-4 transition-transform group-open/waiting:rotate-90"
                />
                {copy.pages.start.waiting} · {waiting.length}
              </summary>
              <ul className="divide-y border-t">
                {waiting.map((habit, i) => (
                  <WaitingRow
                    key={habit.id}
                    {...props}
                    habit={habit}
                    isFirstHabit={i === 0}
                    isLastHabit={i === waiting.length - 1}
                  />
                ))}
              </ul>
            </details>
          )}
          <div className="border-t px-2 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onAddHabit}
              aria-label={t.addHabitTo(phaseLabel(phase))}
            >
              <Plus aria-hidden />
              {t.addHabit}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

type RowProps = PhaseSectionProps & { habit: Habit; isFirstHabit: boolean; isLastHabit: boolean };

function SortableHabitRow(props: RowProps) {
  const { habit } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id, disabled: props.dragDisabled });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  const stats = props.stats.get(habit.id);
  const selected = props.selectedId === habit.id;
  const weakest = props.weakestId === habit.id;

  const percent = stats?.percent != null ? `${Math.round(stats.percent)}%` : t.kpi.none;
  const streakText = stats ? t.streakValue(stats.streak.current, stats.streak.unit) : "";

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-tour={props.isFirstHabit ? "habits-row" : undefined}
      className={cn(
        "flex items-start gap-2 bg-card py-1.5 pr-2 pl-1 sm:items-center",
        selected && "bg-accent",
        isDragging && "relative z-10 opacity-40",
      )}
    >
      {props.dragDisabled ? (
        <span aria-hidden className="size-9 shrink-0 max-sm:hidden" />
      ) : (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t.drag.handle(habit.name)}
          className={cn(
            "flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing",
            !props.reordering && "max-sm:hidden",
          )}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      )}
      <div className="min-w-0 flex-1 max-sm:pl-2">
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => props.onSelectHabit(habit)}
          className="w-full rounded-lg px-1.5 py-1 text-left outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <HabitRowText {...props} />
        </button>
        {/* Phones and tablets: the last 14 days under the name. */}
        {stats && (
          <HistoryDots days={stats.days.slice(-14)} className="mt-1 mb-1 px-1.5 lg:hidden" />
        )}
      </div>
      {stats && <HistoryDots days={stats.days.slice(-14)} className="hidden w-48 lg:flex" />}
      <span className="hidden w-20 text-sm text-muted-foreground tabular-nums sm:block">
        {streakText}
      </span>
      <span className="flex w-16 flex-col items-end self-stretch py-1 text-right tabular-nums sm:block sm:self-auto sm:py-0">
        <span className={cn("block text-sm font-semibold", weakest && "text-warning")}>
          {percent}
        </span>
        {weakest && (
          <span className="block text-[11px] font-medium text-warning uppercase">
            {t.weakestTag}
          </span>
        )}
        <span className="mt-auto block text-sm text-muted-foreground sm:hidden">{streakText}</span>
      </span>
      <HabitMenu {...props} />
    </li>
  );
}

/** A habit that hasn't started: name, when it starts (or "Not started"), a Start button. */
function WaitingRow(props: RowProps) {
  const { habit, today } = props;
  const st = copy.pages.start;
  const later = startState(habit.startsOn, today) === "later";
  return (
    <li className="flex items-center gap-2 bg-card py-2 pr-2 pl-4" data-habit-waiting={habit.name}>
      <button
        type="button"
        onClick={() => props.onSelectHabit(habit)}
        className="min-w-0 flex-1 rounded-lg py-1 text-left text-muted-foreground outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="block font-medium" data-habit-name>
          {habit.name}
        </span>
        <span className="block text-sm">
          {[describeSchedule(habit.schedule), later ? null : st.notStarted]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </button>
      {later ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-primary px-2.5 py-1 text-xs font-medium text-primary">
          <CalendarDays aria-hidden className="size-3.5" />
          {st.startsOn(formatShort(habit.startsOn!))}
        </span>
      ) : (
        <Button
          size="sm"
          variant="outline"
          aria-label={st.startNamed(habit.name)}
          onClick={() => props.onSetStart(habit, today)}
        >
          {st.start}
        </Button>
      )}
      <HabitMenu {...props} />
    </li>
  );
}

/** Column titles above the habit rows (laptop and tablet). Widths match the row cells. */
function ColumnHeader() {
  const c = t.columns;
  return (
    <div
      aria-hidden
      className="hidden items-center gap-2 border-b py-2 pr-2 pl-1 text-xs font-medium tracking-wide text-muted-foreground uppercase md:flex"
    >
      <span className="w-9 shrink-0" />
      <span className="flex-1 px-1.5">{c.habit}</span>
      <span className="hidden w-48 lg:block">{c.last14}</span>
      <span className="hidden w-20 sm:block">{c.streak}</span>
      <span className="w-16 text-right">{c.percent}</span>
      <span className="w-8 shrink-0" />
    </div>
  );
}

/** Name + "5,000 steps · Every day · Fitness" line. Also used for the floating drag preview. */
export function HabitRowText({
  habit,
  targetsByHabit,
  categoryById,
  today,
}: { habit: Habit } & RowContext) {
  const target = targetOn(targetsByHabit.get(habit.id) ?? [], today);
  const category = habit.categoryId ? categoryById.get(habit.categoryId) : undefined;
  // Only what's informative: "Yes / no" and "Every day" are the defaults, so they're left out.
  const pause = today ? habit.pauses.find((p) => p.from <= today && today <= p.to) : undefined;
  // Started in the last week: "New · day 3", and earlier days don't count.
  const startedOn =
    typeof habit.startsOn === "string" && habit.startsOn <= today ? habit.startsOn : null;
  const newDay =
    startedOn && diffDays(today, startedOn) < 7 ? diffDays(today, startedOn) + 1 : null;
  const details = [
    newDay !== null && startedOn ? copy.pages.start.earlierDontCount(formatShort(startedOn)) : null,
    pause ? t.pausedUntil(formatShort(pause.to)) : null,
    habit.type !== "boolean" ? describeTarget(habit, target) : null,
    habit.schedule.kind !== "daily" ? describeSchedule(habit.schedule) : null,
    habit.partOfDay !== "anytime" ? t.partsOfDay[habit.partOfDay] : null,
    category?.name,
  ]
    .filter(Boolean)
    .join(" · ");
  // Spans (not paragraphs): this sits inside a button.
  return (
    <span className="block min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-medium" data-habit-name>
          {habit.name}
        </span>
        {newDay !== null && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {copy.pages.start.newDay(newDay)}
          </span>
        )}
      </span>
      <span className="block text-sm text-muted-foreground">{details}</span>
    </span>
  );
}

function HabitMenu(props: RowProps) {
  const { habit, phase, allPhases, isFirstHabit, isLastHabit, today } = props;
  const a = t.actions;
  const otherPhases = allPhases.filter((p) => p.id !== phase.id);
  const paused = !!today && isPausedOn(habit.pauses, today);
  const pause = paused ? habit.pauses.find((p) => p.from <= today && today <= p.to) : undefined;
  const stats = props.stats.get(habit.id);
  const category = habit.categoryId ? props.categoryById.get(habit.categoryId) : undefined;
  const pct = stats?.percent != null ? Math.round(stats.percent) : null;
  const st = copy.pages.start;
  const state = startState(habit.startsOn, today);
  const dates = [
    { label: st.tomorrow, onSelect: () => props.onSetStart(habit, addDays(today, 1)) },
    { label: st.inAWeek, onSelect: () => props.onSetStart(habit, addDays(today, 7)) },
    { label: st.otherDate, onSelect: () => props.onPickStart(habit) },
  ];
  const startItems: ActionItem[] =
    state === "started"
      ? []
      : [
          {
            label: st.startNow,
            description: st.startNowHint,
            icon: Play,
            onSelect: () => props.onSetStart(habit, today),
          },
          {
            label: state === "later" ? st.changeStart : st.pickStart,
            description: st.pickStartHint,
            icon: CalendarDays,
            children: dates,
          },
          ...(state === "later"
            ? [
                {
                  label: st.dontStart,
                  description: st.dontStartHint,
                  icon: CircleSlash,
                  onSelect: () => props.onSetStart(habit, null),
                },
              ]
            : []),
        ];

  const items: ActionItem[] = [
    ...startItems,
    {
      label: a.open,
      description: a.openHint,
      icon: FileText,
      onSelect: () => props.onSelectHabit(habit),
    },
    {
      label: a.edit,
      description: a.editHint,
      icon: Pencil,
      onSelect: () => props.onEditHabit(habit),
    },
    ...(otherPhases.length > 0
      ? [
          {
            label: a.moveTo,
            description: a.moveToHint(phaseLabel(phase)),
            icon: FolderInput,
            children: otherPhases.map((p) => ({
              label: phaseLabel(p),
              icon: isUnlocked(p) ? undefined : Lock,
              disabled: !isUnlocked(p),
              srNote: isUnlocked(p) ? undefined : t.locked,
              onSelect: () => props.onMoveHabitTo(habit, p.id),
            })),
          },
        ]
      : []),
    {
      label: a.reorder,
      description: a.reorderHint,
      icon: ArrowUpDown,
      disabled: isFirstHabit && isLastHabit,
      children: [
        {
          label: a.moveUp,
          icon: ArrowUp,
          disabled: isFirstHabit,
          onSelect: () => props.onMoveHabit(habit, "up"),
        },
        {
          label: a.moveDown,
          icon: ArrowDown,
          disabled: isLastHabit,
          onSelect: () => props.onMoveHabit(habit, "down"),
        },
      ],
    },
    ...(state !== "started"
      ? []
      : [
          paused
            ? {
                label: a.resume,
                description: pause ? a.resumeHint(formatShort(pause.to)) : undefined,
                icon: Play,
                onSelect: () => props.onResumeHabit(habit),
              }
            : {
                label: a.pause,
                description: a.pauseHint,
                icon: Pause,
                children: [3, 7, 14].map((days) => ({
                  label: a.pauseFor[days],
                  onSelect: () => props.onPauseHabit(habit, days),
                })),
              },
        ]),
    {
      label: a.archive,
      description: a.archiveHint,
      icon: Archive,
      onSelect: () => props.onArchiveHabit(habit),
    },
    {
      label: a.deleteHabit,
      description: a.deleteHint,
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      onSelect: () => props.onDeleteHabit(habit),
    },
  ];

  return (
    <ActionMenu
      label={a.more(habit.name)}
      title={habit.name}
      subtitle={a.sheetSubtitle(
        [
          a.phaseShort(phase.number),
          habit.partOfDay !== "anytime" ? t.partsOfDay[habit.partOfDay] : null,
          category?.name ?? null,
          pct === null ? null : props.weakestId === habit.id ? a.percentWeakest(pct) : `${pct}%`,
        ].filter((x): x is string => !!x),
      )}
      icon={EllipsisVertical}
      items={items}
    />
  );
}

function phaseItems(props: PhaseSectionProps): ActionItem[] {
  const p = t.phaseActions;
  return [
    {
      label: p.addHabit,
      description: p.addHabitHint(props.phase.number),
      icon: Plus,
      onSelect: props.onAddHabit,
    },
    { label: p.edit, description: p.editHint, icon: Pencil, onSelect: props.onEditPhase },
    {
      label: p.reorder,
      description: p.reorderHint,
      icon: GripVertical,
      disabled: props.habits.length < 2 || props.dragDisabled,
      onSelect: () => props.onReorder(true),
    },
    {
      label: p.move,
      description: p.moveHint,
      icon: ChevronsUpDown,
      disabled: props.isFirst && props.isLast,
      children: [
        {
          label: p.moveUp,
          icon: ArrowUp,
          disabled: props.isFirst,
          onSelect: () => props.onMovePhase("up"),
        },
        {
          label: p.moveDown,
          icon: ArrowDown,
          disabled: props.isLast,
          onSelect: () => props.onMovePhase("down"),
        },
      ],
    },
    {
      label: p.delete,
      description: p.deleteHint(props.totalCount),
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      onSelect: props.onDeletePhase,
    },
  ];
}

function StatusBadge({ phase, className }: { phase: Phase; className?: string }) {
  return (
    <Badge
      variant={phase.status === "active" ? "default" : "secondary"}
      className={cn("shrink-0", className)}
    >
      {!isUnlocked(phase) && <Lock aria-hidden />}
      {copy.pages.data.phaseStatus[phase.status]}
    </Badge>
  );
}
