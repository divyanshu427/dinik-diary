"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Ellipsis,
  FolderInput,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copy } from "@/copy";
import { isUnlocked } from "@/data/habit-ops";
import type { Category, Habit, HabitTarget, Phase } from "@/data/schema";
import { targetOn, type HabitStats } from "@/lib/core";
import { cn } from "@/lib/utils";
import { describeSchedule, describeTarget, phaseLabel } from "./format";
import { HistoryDots } from "./history-views";

const t = copy.pages.habits;
export { phaseLabel };
export const containerId = (phaseId: string) => `phase:${phaseId}`;

export interface HabitRowHandlers {
  onEditHabit: (habit: Habit) => void;
  onMoveHabit: (habit: Habit, direction: "up" | "down") => void;
  onMoveHabitTo: (habit: Habit, phaseId: string) => void;
  onArchiveHabit: (habit: Habit) => void;
  onDeleteHabit: (habit: Habit) => void;
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
  /** The current phase's progress, e.g. "Day 9 of 14 · 76%". */
  progressNote?: string;
  open: boolean;
  dropState: DropState;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onAddHabit: () => void;
  onEditPhase: () => void;
  onMovePhase: (direction: "up" | "down") => void;
  onDeletePhase: () => void;
}

/** One phase: a header you click to expand, and its habits, which can be dragged. */
export function PhaseSection(props: PhaseSectionProps) {
  const { phase, habits, open, dropState, isFirst, isLast } = props;
  const { setNodeRef } = useDroppable({ id: containerId(phase.id) });
  const labelId = `phase-label-${phase.id}`;
  const listId = `phase-list-${phase.id}`;
  const locked = !isUnlocked(phase);

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={labelId}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card text-card-foreground transition-shadow",
        dropState === "allowed" && "ring-2 ring-primary",
        dropState === "blocked" && "ring-2 ring-destructive",
      )}
    >
      <header className="flex items-center gap-1 py-1.5 pr-2 pl-1.5">
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
              {phase.description && (
                <span
                  className={cn(
                    "block text-sm font-normal text-muted-foreground",
                    !open && "line-clamp-1",
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
          {t.habitCount(props.totalCount)}
        </span>
        <Badge variant={phase.status === "active" ? "default" : "secondary"} className="shrink-0">
          {locked && <Lock aria-hidden />}
          {copy.pages.data.phaseStatus[phase.status]}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={t.phaseActions.more(phase.name)} />
            }
          >
            <Ellipsis aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            <DropdownMenuItem onClick={props.onEditPhase}>
              <Pencil aria-hidden />
              {t.phaseActions.edit}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isFirst} onClick={() => props.onMovePhase("up")}>
              <ArrowUp aria-hidden />
              {t.phaseActions.moveUp}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onClick={() => props.onMovePhase("down")}>
              <ArrowDown aria-hidden />
              {t.phaseActions.moveDown}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={props.onDeletePhase}>
              <Trash2 aria-hidden />
              {t.phaseActions.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          <SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
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
                <ColumnHeader />
                <ul className="divide-y">
                  {habits.map((habit, i) => (
                    <SortableHabitRow
                      key={habit.id}
                      {...props}
                      habit={habit}
                      isFirstHabit={i === 0}
                      isLastHabit={i === habits.length - 1}
                    />
                  ))}
                </ul>
              </>
            )}
          </SortableContext>
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

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 bg-card py-1.5 pr-2 pl-1",
        selected && "bg-accent",
        isDragging && "relative z-10 opacity-40",
      )}
    >
      {props.dragDisabled ? (
        <span aria-hidden className="size-9 shrink-0" />
      ) : (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t.drag.handle(habit.name)}
          className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      )}
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => props.onSelectHabit(habit)}
        className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <HabitRowText {...props} />
      </button>
      {stats && <HistoryDots days={stats.days.slice(-14)} className="hidden w-48 lg:flex" />}
      <span className="hidden w-20 text-sm text-muted-foreground tabular-nums sm:block">
        {stats ? t.streakValue(stats.streak.current, stats.streak.unit) : ""}
      </span>
      <span className="w-16 text-right tabular-nums">
        <span className={cn("block text-sm font-semibold", weakest && "text-warning")}>
          {stats?.percent != null ? `${Math.round(stats.percent)}%` : t.kpi.none}
        </span>
        {weakest && (
          <span className="block text-[11px] font-medium text-warning uppercase">
            {t.weakestTag}
          </span>
        )}
      </span>
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
  const details = [
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
      <span className="block font-medium" data-habit-name>
        {habit.name}
      </span>
      <span className="block text-sm text-muted-foreground">{details}</span>
    </span>
  );
}

function HabitMenu({
  habit,
  phase,
  allPhases,
  isFirstHabit,
  isLastHabit,
  onEditHabit,
  onMoveHabit,
  onMoveHabitTo,
  onArchiveHabit,
  onDeleteHabit,
}: RowProps) {
  const otherPhases = allPhases.filter((p) => p.id !== phase.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={t.actions.more(habit.name)} />}
      >
        <Ellipsis aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        <DropdownMenuItem onClick={() => onEditHabit(habit)}>
          <Pencil aria-hidden />
          {t.actions.edit}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isFirstHabit} onClick={() => onMoveHabit(habit, "up")}>
          <ArrowUp aria-hidden />
          {t.actions.moveUp}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isLastHabit} onClick={() => onMoveHabit(habit, "down")}>
          <ArrowDown aria-hidden />
          {t.actions.moveDown}
        </DropdownMenuItem>
        {otherPhases.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput aria-hidden />
              {t.actions.moveTo}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-56">
              {otherPhases.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  disabled={!isUnlocked(p)}
                  onClick={() => onMoveHabitTo(habit, p.id)}
                >
                  {!isUnlocked(p) && <Lock aria-hidden />}
                  {phaseLabel(p)}
                  {!isUnlocked(p) && <span className="sr-only"> ({t.locked})</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onClick={() => onArchiveHabit(habit)}>
          <Archive aria-hidden />
          {t.actions.archive}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDeleteHabit(habit)}>
          <Trash2 aria-hidden />
          {t.actions.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
