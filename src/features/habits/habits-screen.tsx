"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, GripVertical, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Cell, Dashboard } from "@/components/dashboard";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { isUnlocked } from "@/data/habit-ops";
import {
  PART_OF_DAY,
  type Habit,
  type HabitTarget,
  type PartOfDay,
  type Phase,
} from "@/data/schema";
import { queryKeys } from "@/hooks/query-keys";
import {
  useCategories,
  useDayStatuses,
  useHabitLogs,
  useHabits,
  useHabitTargets,
  usePhases,
  useSettings,
} from "@/hooks/use-data";
import { useMediaQuery, WIDE_QUERY } from "@/hooks/use-media-query";
import { useHabitEditor, useHabitLogCount } from "@/hooks/use-habit-editor";
import { targetOn } from "@/lib/core";
import { cn } from "@/lib/utils";
import { emptyHabitForm, habitToForm } from "./habit-form";
import { HabitDetail } from "./habit-detail";
import { HabitFormDialog } from "./habit-form-dialog";
import { useReadiness } from "@/features/phases/use-readiness";
import { useHabitStats } from "./use-habit-stats";
import { HabitRowText, PhaseSection, phaseLabel, type DropState } from "./phase-section";
import { PhaseFormDialog } from "./phase-form-dialog";
import { useOpenPhases } from "./use-open-phases";

const t = copy.pages.habits;

type HabitDialog = { mode: "create"; phaseId: string } | { mode: "edit"; habit: Habit } | null;
type PhaseDialog = { mode: "create" } | { mode: "edit"; phase: Phase } | null;
type Confirm = { kind: "habit"; habit: Habit } | { kind: "phase"; phase: Phase } | null;
type Filter =
  { kind: "all" } | { kind: "part"; value: PartOfDay } | { kind: "category"; id: string };
const ALL: Filter = { kind: "all" };
const sameFilter = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b);

/** "Grooming and hygiene" → "Grooming", for compact filter chips (the full name is the tooltip). */
const shortCategoryName = (name: string) => name.split(" and ")[0];

/** Habit ids per phase id, in display order. */
type Arrangement = Record<string, string[]>;

interface DragState {
  habitId: string;
  /** Phase the habit started in. */
  fromPhaseId: string;
  fromIndex: number;
  /** Live arrangement while dragging (the habit moves between phases as you hover). */
  items: Arrangement;
  /** Phase under the pointer. */
  overPhaseId: string | null;
}

export function HabitsScreen() {
  const qc = useQueryClient();
  const phases = usePhases();
  const habits = useHabits();
  const targets = useHabitTargets();
  const categories = useCategories();
  const editor = useHabitEditor();
  const openPhases = useOpenPhases();
  const logs = useHabitLogs();
  const dayStatuses = useDayStatuses();
  const settings = useSettings();
  const wide = useMediaQuery(WIDE_QUERY);

  const [habitDialog, setHabitDialog] = useState<HabitDialog>(null);
  const [phaseDialog, setPhaseDialog] = useState<PhaseDialog>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [filter, setFilter] = useState<Filter>(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Phones and tablets: habit details open in a dialog instead of a side panel. */
  const [detailOpen, setDetailOpen] = useState(false);
  // Drag events can fire faster than React re-renders, so handlers read the latest drag state
  // from a ref. Both are only ever written together, inside event handlers (commitDrag).
  const dragRef = useRef<DragState | null>(null);
  const commitDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const editingId = habitDialog?.mode === "edit" ? habitDialog.habit.id : null;
  const logCount = useHabitLogCount(editingId);

  const sensors = useSensors(
    // A small movement starts a drag, so a plain click on the handle does nothing.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const targetsByHabit = useMemo(() => {
    const map = new Map<string, HabitTarget[]>();
    for (const target of targets.data ?? []) {
      map.set(target.habitId, [...(map.get(target.habitId) ?? []), target]);
    }
    return map;
  }, [targets.data]);

  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );

  const habitById = useMemo(
    () => new Map((habits.data ?? []).map((h) => [h.id, h])),
    [habits.data],
  );
  const phaseById = useMemo(
    () => new Map((phases.data ?? []).map((p) => [p.id, p])),
    [phases.data],
  );

  /** Saved order: visible habits per phase. */
  const saved: Arrangement = useMemo(() => {
    const result: Arrangement = {};
    for (const p of phases.data ?? []) result[p.id] = [];
    for (const h of habits.data ?? []) {
      if (!h.archived && result[h.phaseId]) result[h.phaseId].push(h.id);
    }
    return result;
  }, [phases.data, habits.data]);

  const today = editor.today;
  const { readiness, paused } = useReadiness();
  const input14 = useMemo(
    () =>
      habits.data && logs.data && dayStatuses.data && settings.data && today
        ? {
            habits: habits.data,
            targetsByHabit,
            logs: logs.data,
            dayStatuses: dayStatuses.data,
            settings: settings.data,
            today,
            windowDays: 14,
            pausedDates: paused,
          }
        : null,
    [habits.data, logs.data, dayStatuses.data, settings.data, targetsByHabit, today, paused],
  );
  const input30 = useMemo(() => input14 && { ...input14, windowDays: 30 }, [input14]);
  const stats14 = useHabitStats(input14);
  const stats30 = useHabitStats(input30);
  // Eight weeks, for per-habit insights ("most on weekends…").
  const input56 = useMemo(() => input14 && { ...input14, windowDays: 56 }, [input14]);
  const stats56 = useHabitStats(input56);

  if (phases.isError || habits.isError || targets.isError || categories.isError) {
    return (
      <>
        <PageHeader title={t.title} subtitle={t.subtitle} />
        <p role="alert" className="text-sm text-destructive">
          {t.loadError}
        </p>
      </>
    );
  }

  const loaded = phases.data && habits.data && targets.data && categories.data && editor.ready;
  const phaseList = phases.data ?? [];
  const habitList = habits.data ?? [];
  const archived = habitList.filter((h) => h.archived);
  const defaultPhaseId = (phaseList.find((p) => p.status === "active") ?? phaseList[0])?.id;
  const todayDate = today ?? "";
  const arrangement = drag?.items ?? saved;

  /** Runs a change and shows a readable error if it fails. */
  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(t.failed(err instanceof Error ? err.message : String(err)));
    }
  };

  // ---------- drag and drop ----------

  const phaseOf = (id: UniqueIdentifier, items: Arrangement): string | undefined => {
    const key = String(id);
    if (key.startsWith("phase:")) return key.slice("phase:".length);
    return Object.keys(items).find((p) => items[p].includes(key));
  };

  /** A habit may enter a phase if it's unlocked, or if it's the phase it came from. */
  const mayEnter = (phaseId: string, d: DragState) => {
    const phase = phaseById.get(phaseId);
    return phaseId === d.fromPhaseId || (!!phase && isUnlocked(phase));
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const habitId = String(active.id);
    const fromPhaseId = phaseOf(habitId, saved);
    if (!fromPhaseId) return;
    setError(null);
    commitDrag({
      habitId,
      fromPhaseId,
      fromIndex: saved[fromPhaseId].indexOf(habitId),
      items: structuredClone(saved),
      overPhaseId: fromPhaseId,
    });
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const overPhaseId = over ? (phaseOf(over.id, d.items) ?? null) : null;
    const current = phaseOf(active.id, d.items);
    if (!overPhaseId || !current || overPhaseId === current || !mayEnter(overPhaseId, d)) {
      if (d.overPhaseId !== overPhaseId) commitDrag({ ...d, overPhaseId });
      return;
    }
    // Move the habit into the hovered phase, next to the habit it's over (or at the end).
    const items = { ...d.items };
    items[current] = items[current].filter((id) => id !== d.habitId);
    const target = [...items[overPhaseId]];
    const overIndex = over ? target.indexOf(String(over.id)) : -1;
    const below =
      over && active.rect.current.translated
        ? active.rect.current.translated.top > over.rect.top + over.rect.height / 2
        : false;
    const at = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
    target.splice(at, 0, d.habitId);
    items[overPhaseId] = target;
    commitDrag({ ...d, items, overPhaseId });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const d = dragRef.current;
    commitDrag(null);
    if (!d || !over) return;

    const overPhaseId = phaseOf(over.id, d.items);
    if (overPhaseId && !mayEnter(overPhaseId, d)) {
      setError(t.lockedDrop(phaseLabel(phaseById.get(overPhaseId)!)));
      return;
    }

    const phaseId = phaseOf(active.id, d.items);
    if (!phaseId) return;
    let list = d.items[phaseId];
    const overIndex = list.indexOf(String(over.id));
    if (overIndex >= 0) list = arrayMove(list, list.indexOf(d.habitId), overIndex);
    const index = list.indexOf(d.habitId);
    if (phaseId === d.fromPhaseId && index === d.fromIndex) return; // dropped where it was

    // Show the new order straight away; it's saved in the background.
    const final = { ...d.items, [phaseId]: list };
    qc.setQueryData<Habit[]>(queryKeys.habits, (old) =>
      old?.map((h) => {
        for (const pid of [d.fromPhaseId, phaseId]) {
          const i = final[pid].indexOf(h.id);
          if (i >= 0) return { ...h, phaseId: pid, sortOrder: i };
        }
        return h;
      }),
    );
    openPhases.expand(phaseId);
    void run(() => editor.placeHabit.mutateAsync([d.habitId, phaseId, index]));
  };

  const nameOf = (id: UniqueIdentifier) => habitById.get(String(id))?.name ?? "";
  const phaseNameOf = (id: UniqueIdentifier | undefined) => {
    const pid = id === undefined ? undefined : phaseOf(id, drag?.items ?? saved);
    const phase = pid ? phaseById.get(pid) : undefined;
    return phase ? phaseLabel(phase) : "";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => t.drag.pickedUp(nameOf(active.id)),
    onDragOver: ({ active, over }) => {
      if (!over) return undefined;
      const items = drag?.items ?? saved;
      const pid = phaseOf(over.id, items);
      const list = pid ? items[pid] : [];
      const overIndex = list.indexOf(String(over.id));
      // Over a habit: that habit's slot. Over the phase itself: the end of the list.
      const position = overIndex >= 0 ? overIndex + 1 : list.length;
      return t.drag.over(nameOf(active.id), phaseNameOf(over.id), position, list.length);
    },
    onDragEnd: ({ active, over }) =>
      over
        ? t.drag.dropped(nameOf(active.id), phaseNameOf(over.id))
        : t.drag.cancelled(nameOf(active.id)),
    onDragCancel: ({ active }) => t.drag.cancelled(nameOf(active.id)),
  };

  const dropStateFor = (phaseId: string): DropState => {
    if (!drag || drag.overPhaseId !== phaseId || phaseId === drag.fromPhaseId) return "none";
    return mayEnter(phaseId, drag) ? "allowed" : "blocked";
  };

  const draggedHabit = drag ? habitById.get(drag.habitId) : undefined;
  const rowContext = { allPhases: phaseList, targetsByHabit, categoryById, today: todayDate };

  // ---------- summary tiles, filters, selection ----------

  const unlockedIds = new Set(phaseList.filter(isUnlocked).map((p) => p.id));
  const visible = habitList.filter((h) => !h.archived);
  const activeHabits = visible.filter((h) => unlockedIds.has(h.phaseId));
  const waiting = visible.length - activeHabits.length;

  const activeStats = activeHabits.flatMap((habit) => {
    const st = stats14.get(habit.id);
    return st ? [{ habit, st }] : [];
  });
  const withRate = activeStats.filter((x) => x.st.percent !== null);
  const average = withRate.length
    ? Math.round(withRate.reduce((sum, x) => sum + (x.st.percent ?? 0), 0) / withRate.length)
    : null;
  const best = activeStats.reduce<(typeof activeStats)[number] | null>(
    (top, x) => (!top || x.st.streak.current > top.st.streak.current ? x : top),
    null,
  );
  const weakest =
    withRate.length >= 2
      ? withRate.reduce((low, x) => ((x.st.percent ?? 0) < (low.st.percent ?? 0) ? x : low))
      : null;
  // Only call a habit "weakest" when it's below the unlock target (default 80%).
  const weakestId =
    weakest && (weakest.st.percent ?? 0) < (settings.data?.unlockThreshold ?? 80)
      ? weakest.habit.id
      : null;

  const filtering = filter.kind !== "all";
  const matches = (h: Habit) =>
    filter.kind === "all" ||
    (filter.kind === "part" ? h.partOfDay === filter.value : h.categoryId === filter.id);
  // Chips come from the active habits only, so the row stays short and relevant.
  const partsPresent = PART_OF_DAY.filter(
    (p) => p !== "anytime" && activeHabits.some((h) => h.partOfDay === p),
  );
  const categoriesPresent = (categories.data ?? []).filter((c) =>
    activeHabits.some((h) => h.categoryId === c.id),
  );
  const filterOptions: { filter: Filter; label: string; title?: string }[] = [
    { filter: ALL, label: t.filters.all },
    ...partsPresent.map((value) => ({
      filter: { kind: "part", value } as Filter,
      label: t.partsOfDay[value],
    })),
    ...categoriesPresent.map((c) => ({
      filter: { kind: "category", id: c.id } as Filter,
      label: shortCategoryName(c.name),
      title: c.name,
    })),
  ];

  // Laptop: the detail panel always shows a habit (the first active one until you pick another).
  const firstActive = phaseList
    .filter(isUnlocked)
    .flatMap((p) => arrangement[p.id] ?? [])
    .map((id) => habitById.get(id))
    .find((h): h is Habit => !!h && matches(h));
  const selected = (selectedId ? habitById.get(selectedId) : undefined) ?? firstActive;
  const selectHabit = (habit: Habit) => {
    setSelectedId(habit.id);
    if (!wide) setDetailOpen(true);
  };

  const detailFor = (habit: Habit, hideTitle?: boolean) => (
    <HabitDetail
      habit={habit}
      phase={phaseById.get(habit.phaseId)}
      category={habit.categoryId ? categoryById.get(habit.categoryId) : undefined}
      targets={targetsByHabit.get(habit.id) ?? []}
      stats14={stats14.get(habit.id)}
      stats30={stats30.get(habit.id)}
      upcoming={(phases.data ?? [])
        .filter((p) => p.status === "locked")
        .flatMap((p) =>
          p.targetUpgrades
            .filter((u) => u.habitId === habit.id)
            .map((u) => ({ phase: p, upgrade: u })),
        )}
      recentDays={stats56.get(habit.id)?.days}
      today={todayDate}
      onEdit={() => setHabitDialog({ mode: "edit", habit })}
      hideTitle={hideTitle}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow={loaded ? t.headerSummary(activeHabits.length, waiting) : undefined}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                defaultPhaseId && setHabitDialog({ mode: "create", phaseId: defaultPhaseId })
              }
              disabled={!loaded || !defaultPhaseId}
            >
              <Plus aria-hidden />
              {t.addHabit}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPhaseDialog({ mode: "create" })}
              disabled={!loaded}
            >
              <Plus aria-hidden />
              {t.addPhase}
            </Button>
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

      {!loaded ? (
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      ) : (
        <Dashboard>
          <Cell span={12} fullOnTablet>
            {/* Summary tiles: 2 × 2 on phones, 4 in a row from laptop width. */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-5">
              <StatTile
                label={t.kpi.active}
                value={String(activeHabits.length)}
                note={t.kpi.activeNote(waiting)}
              />
              <StatTile
                label={t.kpi.average}
                value={average !== null ? `${average}%` : t.kpi.none}
                note={average !== null ? t.kpi.averageNote : t.kpi.noCheckIns}
              />
              <StatTile
                label={t.kpi.bestStreak}
                value={
                  best ? t.streakValue(best.st.streak.current, best.st.streak.unit) : t.kpi.none
                }
                note={best && best.st.streak.current > 0 ? best.habit.name : t.kpi.startStreak}
                tone={best && best.st.streak.current > 0 ? "positive" : "neutral"}
              />
              <StatTile
                label={t.kpi.weakest}
                value={
                  weakestId && weakest ? `${Math.round(weakest.st.percent ?? 0)}%` : t.kpi.none
                }
                note={weakestId && weakest ? weakest.habit.name : t.kpi.weakestEmpty}
                tone={weakestId ? "warning" : "neutral"}
              />
            </div>
          </Cell>

          <Cell span={12} fullOnTablet>
            {/* Phones: one row you can swipe sideways. Wider screens: wraps. */}
            <div
              role="group"
              aria-label={t.filters.label}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
            >
              {filterOptions.map((option) => {
                const active = sameFilter(option.filter, filter);
                return (
                  <button
                    key={option.label}
                    type="button"
                    title={option.title}
                    aria-pressed={active}
                    onClick={() => setFilter(option.filter)}
                    className={cn(
                      "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:bg-muted",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {filtering && <p className="mt-2 text-sm text-muted-foreground">{t.filters.dragOff}</p>}
          </Cell>

          <Cell span={8} fullOnTablet className="flex flex-col gap-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={() => commitDrag(null)}
              accessibility={{
                announcements,
                screenReaderInstructions: { draggable: t.drag.instructions },
              }}
            >
              {phaseList.map((phase, i) => (
                <PhaseSection
                  key={phase.id}
                  {...rowContext}
                  phase={phase}
                  habits={(arrangement[phase.id] ?? [])
                    .flatMap((id) => habitById.get(id) ?? [])
                    .filter(matches)}
                  totalCount={(arrangement[phase.id] ?? []).length}
                  progressNote={
                    readiness?.phase?.id === phase.id && readiness.state !== "paused"
                      ? t.phaseProgress(
                          readiness.dayNumber,
                          readiness.rules.windowDays,
                          readiness.average === null ? null : Math.round(readiness.average),
                        )
                      : undefined
                  }
                  stats={stats14}
                  selectedId={wide ? (selected?.id ?? null) : null}
                  weakestId={weakestId}
                  onSelectHabit={selectHabit}
                  dragDisabled={filtering}
                  open={openPhases.isOpen(phase.id)}
                  dropState={dropStateFor(phase.id)}
                  isFirst={i === 0}
                  isLast={i === phaseList.length - 1}
                  onToggle={() => openPhases.toggle(phase.id)}
                  onAddHabit={() => setHabitDialog({ mode: "create", phaseId: phase.id })}
                  onEditPhase={() => setPhaseDialog({ mode: "edit", phase })}
                  onMovePhase={(dir) => run(() => editor.reorderPhase.mutateAsync([phase.id, dir]))}
                  onDeletePhase={() => setConfirm({ kind: "phase", phase })}
                  onEditHabit={(habit) => setHabitDialog({ mode: "edit", habit })}
                  onMoveHabit={(habit, dir) =>
                    run(() => editor.reorderHabit.mutateAsync([habit.id, dir]))
                  }
                  onMoveHabitTo={(habit, phaseId) => {
                    openPhases.expand(phaseId);
                    void run(() => editor.moveHabit.mutateAsync([habit.id, phaseId]));
                  }}
                  onArchiveHabit={(habit) =>
                    run(() => editor.setArchived.mutateAsync([habit.id, true]))
                  }
                  onDeleteHabit={(habit) => setConfirm({ kind: "habit", habit })}
                />
              ))}
              <DragOverlay>
                {draggedHabit && (
                  <div
                    data-testid="drag-preview"
                    className="flex items-center gap-1 rounded-xl border bg-card py-2 pr-4 pl-1 shadow-lg"
                  >
                    <span className="flex size-9 items-center justify-center text-muted-foreground">
                      <GripVertical aria-hidden className="size-4" />
                    </span>
                    <HabitRowText habit={draggedHabit} {...rowContext} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            {archived.length > 0 && (
              <details className="group rounded-2xl border bg-card">
                <summary className="cursor-pointer list-none px-4 py-3 outline-none focus-visible:bg-muted [&::-webkit-details-marker]:hidden">
                  <span className="font-heading font-semibold">
                    {t.archivedTitle(archived.length)}
                  </span>
                  <span className="block text-sm text-muted-foreground">{t.archivedHint}</span>
                </summary>
                <ul className="divide-y border-t">
                  {archived.map((habit) => {
                    const phase = phaseById.get(habit.phaseId);
                    return (
                      <li key={habit.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{habit.name}</p>
                          {phase && (
                            <p className="text-sm text-muted-foreground">
                              {t.inPhase(phaseLabel(phase))}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            run(() => editor.setArchived.mutateAsync([habit.id, false]))
                          }
                        >
                          <ArchiveRestore aria-hidden />
                          {t.actions.restore}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirm({ kind: "habit", habit })}
                        >
                          <Trash2 aria-hidden />
                          {t.actions.delete}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </Cell>

          {wide && (
            <Cell span={4} className="xl:sticky xl:top-6 xl:self-start">
              <section
                aria-label={t.detail.title}
                className="rounded-2xl border bg-card p-5 text-card-foreground"
              >
                {selected ? (
                  detailFor(selected)
                ) : (
                  <p className="text-sm text-muted-foreground">{t.detail.empty}</p>
                )}
              </section>
            </Cell>
          )}
        </Dashboard>
      )}

      {!wide && selected && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected.name}</DialogTitle>
            </DialogHeader>
            {detailFor(selected, true)}
          </DialogContent>
        </Dialog>
      )}

      {habitDialog && loaded && (habitDialog.mode === "create" || logCount.data !== undefined) && (
        <HabitFormDialog
          mode={habitDialog.mode}
          initial={
            habitDialog.mode === "create"
              ? emptyHabitForm(habitDialog.phaseId, todayDate)
              : habitToForm(
                  habitDialog.habit,
                  targetOn(targetsByHabit.get(habitDialog.habit.id) ?? [], todayDate),
                  todayDate,
                )
          }
          phases={phaseList}
          categories={categories.data ?? []}
          measurementLocked={habitDialog.mode === "edit" && (logCount.data ?? 0) > 0}
          onSubmit={async (draft) => {
            const result =
              habitDialog.mode === "create"
                ? await editor.createHabit.mutateAsync([draft])
                : await editor.updateHabit.mutateAsync([habitDialog.habit.id, draft]);
            openPhases.expand(draft.phaseId); // show where the habit ended up
            return result;
          }}
          onClose={() => setHabitDialog(null)}
        />
      )}

      {phaseDialog && (
        <PhaseFormDialog
          mode={phaseDialog.mode}
          initial={
            phaseDialog.mode === "edit"
              ? { name: phaseDialog.phase.name, description: phaseDialog.phase.description }
              : { name: "", description: "" }
          }
          onSubmit={async (draft) => {
            if (phaseDialog.mode === "edit")
              return editor.updatePhase.mutateAsync([phaseDialog.phase.id, draft]);
            const phase = await editor.createPhase.mutateAsync([draft]);
            openPhases.expand(phase.id);
            return phase;
          }}
          onClose={() => setPhaseDialog(null)}
        />
      )}

      <ConfirmDelete
        confirm={confirm}
        habitsInPhase={
          confirm?.kind === "phase"
            ? habitList.filter((h) => h.phaseId === confirm.phase.id).length
            : 0
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          const work =
            confirm.kind === "habit"
              ? () => editor.deleteHabit.mutateAsync([confirm.habit.id])
              : () => editor.deletePhase.mutateAsync([confirm.phase.id]);
          setConfirm(null);
          void run(work);
        }}
      />
    </>
  );
}

function ConfirmDelete({
  confirm,
  habitsInPhase,
  onCancel,
  onConfirm,
}: {
  confirm: Confirm;
  habitsInPhase: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const blocked = confirm?.kind === "phase" && habitsInPhase > 0;
  const title =
    confirm?.kind === "habit"
      ? t.deleteHabitTitle(confirm.habit.name)
      : confirm?.kind === "phase"
        ? t.deletePhaseTitle(confirm.phase.name)
        : "";
  const body =
    confirm?.kind === "habit"
      ? t.deleteHabitBody
      : blocked
        ? t.deletePhaseNotEmpty
        : t.deletePhaseBody;

  return (
    <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
          {!blocked && (
            <AlertDialogAction variant="destructive" onClick={onConfirm}>
              {confirm?.kind === "habit" ? t.deleteHabitConfirm : t.deletePhaseConfirm}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
