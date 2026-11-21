"use client";

import { ChevronRight, HeartPulse, Plus, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Cell, Dashboard, Panel } from "@/components/dashboard";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
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
import type { HealthIssueDraft } from "@/data/health-ops";
import type { Concern } from "@/data/schema";
import { emptyHabitForm, type HabitFormValues } from "@/features/habits/habit-form";
import { HabitFormDialog } from "@/features/habits/habit-form-dialog";
import { useCategories } from "@/hooks/use-data";
import { useHabitEditor } from "@/hooks/use-habit-editor";
import { formatNumber } from "@/features/today/format";
import { useHealthEditor } from "@/hooks/use-health";
import { useLabValues } from "@/hooks/use-reports";
import { addDays, isActiveAdjustment, labSeries, parseIsoDate, type IsoDate } from "@/lib/core";
import { cn } from "@/lib/utils";
import { CheckInDialog } from "./check-in-dialog";
import { HealthTabs } from "./health-tabs";
import { IssueCard } from "./issue-card";
import { IssueFormDialog } from "./issue-form-dialog";
import { PlanCard } from "./plan-card";
import { useHealthModel, type HealthModel } from "./use-health-model";

const t = copy.pages.health;
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const fmt = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return shortDate.format(new Date(year, month - 1, day));
};

export const emptyIssueDraft = (today: IsoDate): HealthIssueDraft => ({
  title: "",
  kind: "symptom",
  bodyArea: "",
  startedAt: today,
  severity: 5,
  worseWith: "",
  helpsWith: "",
  triedSoFar: "",
  notes: "",
  linkedHabitIds: [],
  strainHabitIds: [],
  note: "",
});

const toDraft = (i: Concern): HealthIssueDraft => ({
  title: i.title,
  kind: i.kind,
  bodyArea: i.bodyArea,
  startedAt: i.startedAt,
  severity: i.severity,
  worseWith: i.worseWith,
  helpsWith: i.helpsWith,
  triedSoFar: i.triedSoFar,
  notes: i.notes,
  linkedHabitIds: [...i.linkedHabitIds],
  strainHabitIds: [...i.strainHabitIds],
});

/** Health (Build Phase 12): issues, check-ins and a plan for the next few days. */
export function HealthScreen() {
  const { model, isError } = useHealthModel();
  const editor = useHealthEditor();
  const habitEditor = useHabitEditor();
  const categories = useCategories();
  const [form, setForm] = useState<{ mode: "create" } | { mode: "edit"; issue: Concern } | null>(
    null,
  );
  const [checkInFor, setCheckInFor] = useState<Concern | null>(null);
  const [toDelete, setToDelete] = useState<Concern | null>(null);
  const [helper, setHelper] = useState<{ issue: Concern; initial: HabitFormValues } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isError) {
    return (
      <>
        <PageHeader title={t.title} />
        <p role="alert" className="text-sm text-destructive">
          {t.loadError}
        </p>
      </>
    );
  }
  if (!model) {
    return (
      <>
        <PageHeader title={t.title} />
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </>
    );
  }

  const { today, active } = model;
  const run = (work: Promise<unknown>) => {
    setError(null);
    work.catch((e) => setError(t.failed(e instanceof Error ? e.message : String(e))));
  };
  const checkedInToday = active.filter((i) =>
    model.checkInsFor(i.id).some((c) => c.date === today),
  ).length;

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow(active.length, checkedInToday)}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <div className="flex flex-col gap-3 max-md:w-full md:flex-row md:flex-wrap md:items-center md:gap-2">
            <HealthTabs />
            <Button
              data-tour="health-add"
              onClick={() => setForm({ mode: "create" })}
              className="max-md:h-12 max-md:rounded-xl max-md:text-base"
            >
              <Plus aria-hidden />
              {t.add}
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

      {model.issues.length === 0 ? (
        <Dashboard>
          <Cell span={8} fullOnTablet>
            <EmptyState icon={HeartPulse} title={t.empty.title} body={t.empty.body}>
              <Button onClick={() => setForm({ mode: "create" })}>
                <Plus aria-hidden />
                {t.add}
              </Button>
            </EmptyState>
          </Cell>
          <Cell span={4} className="flex flex-col gap-4 md:col-span-2 xl:col-span-4 xl:gap-5">
            <OutOfRange />
            <SafetyPanel />
          </Cell>
        </Dashboard>
      ) : (
        <Dashboard>
          <Cell span={12} fullOnTablet>
            <Tiles
              model={model}
              checkedInToday={checkedInToday}
              onCheckIn={() => {
                const next =
                  active.find((i) => !model.checkInsFor(i.id).some((c) => c.date === today)) ??
                  active[0];
                if (next) setCheckInFor(next);
              }}
            />
          </Cell>

          {/* Phones: both columns melt into one list, in the mock-up's order (see `order-*`). */}
          <Cell span={8} fullOnTablet className="flex flex-col gap-4 max-md:contents xl:gap-5">
            <Panel
              title={t.plan.title}
              subtitle={t.plan.subtitle}
              className="scroll-mt-6 max-md:order-1"
              id="health-plan"
              tour="health-plan"
            >
              <PlanCard
                model={model}
                editor={editor}
                run={run}
                onCheckIn={setCheckInFor}
                onAddHelper={(issue, s) =>
                  model.currentPhaseId &&
                  setHelper({
                    issue,
                    initial: {
                      ...emptyHabitForm(model.currentPhaseId, today),
                      name: s.name ?? (s.profile ? t.library[s.profile].helper : issue.title),
                      type: s.habit.type,
                      unit: s.habit.unit,
                      targetValue: s.habit.target === null ? "" : String(s.habit.target),
                      partOfDay: s.habit.partOfDay,
                      description: issue.title,
                    },
                  })
                }
              />
            </Panel>
            <div className="grid gap-4 max-md:order-2 xl:gap-5 2xl:grid-cols-2">
              {active.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  checkIns={model.checkInsFor(issue.id)}
                  today={today}
                  habitById={model.habitById}
                  roles={model.rolesFor(issue)}
                  onCheckIn={() => setCheckInFor(issue)}
                  onEdit={() => setForm({ mode: "edit", issue })}
                  onStatus={(status) => run(editor.setStatus.mutateAsync([issue.id, status]))}
                  onDelete={() => setToDelete(issue)}
                  onDeleteCheckIn={(id) => run(editor.deleteCheckIn.mutateAsync([id]))}
                />
              ))}
            </div>
          </Cell>

          <Cell
            span={4}
            className="flex flex-col gap-4 max-md:contents md:col-span-2 xl:col-span-4 xl:gap-5"
          >
            <OutOfRange className="max-md:order-3" />
            <Journal model={model} className="max-md:order-5" />
            <SafetyPanel className="max-md:order-4" />
            <Panel title={t.resolved.title} className="max-md:order-6">
              {model.resolved.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.resolved.empty}</p>
              ) : (
                <ul className="flex flex-col divide-y text-sm">
                  {model.resolved.map((issue) => (
                    <li key={issue.id} className="flex items-center justify-between gap-3 py-2">
                      <span>{issue.title}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => run(editor.setStatus.mutateAsync([issue.id, "active"]))}
                      >
                        {t.issue.markActive}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </Cell>
        </Dashboard>
      )}

      {form && (
        <IssueFormDialog
          mode={form.mode}
          initial={form.mode === "edit" ? toDraft(form.issue) : emptyIssueDraft(today)}
          habits={model.advisorHabits}
          onSubmit={(draft) =>
            form.mode === "edit"
              ? editor.updateIssue.mutateAsync([form.issue.id, draft])
              : editor.createIssue.mutateAsync([draft])
          }
          onClose={() => setForm(null)}
        />
      )}

      {checkInFor && (
        <CheckInDialog
          issue={checkInFor}
          checkIns={model.checkInsFor(checkInFor.id)}
          today={today}
          onSubmit={(date, level, note) =>
            editor.checkIn.mutateAsync([checkInFor.id, date, level, note])
          }
          onClose={() => setCheckInFor(null)}
        />
      )}

      {helper && (
        <HabitFormDialog
          mode="create"
          initial={helper.initial}
          phases={model.phases}
          categories={categories.data ?? []}
          measurementLocked={false}
          onSubmit={async (draft) => {
            const habit = await habitEditor.createHabit.mutateAsync([draft]);
            await editor.linkHelpingHabit.mutateAsync([helper.issue.id, habit.id]);
          }}
          onClose={() => setHelper(null)}
        />
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toDelete ? t.issue.deleteTitle(toDelete.title) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>{t.issue.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.issue.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const id = toDelete?.id;
                setToDelete(null);
                if (id) run(editor.deleteIssue.mutateAsync([id]));
              }}
            >
              {t.issue.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Tiles({
  model,
  checkedInToday,
  onCheckIn,
}: {
  model: HealthModel;
  checkedInToday: number;
  onCheckIn: () => void;
}) {
  const { today, active } = model;
  const weekAgo = addDays(today, -6);
  let worst: { title: string; level: number } | null = null;
  for (const issue of active) {
    for (const c of model.checkInsFor(issue.id)) {
      if (c.date >= weekAgo && (!worst || c.severity > worst.level)) {
        worst = { title: issue.title, level: c.severity };
      }
    }
  }
  const running = model.issues.reduce(
    (n, i) => n + i.adjustments.filter((a) => isActiveAdjustment(a, today)).length,
    0,
  );
  const waiting = model.suggestions.length;
  const allIn = active.length > 0 && checkedInToday === active.length;
  return (
    <div
      className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-5"
      data-testid="health-tiles"
      data-tour="health-tiles"
    >
      <StatTile
        label={t.tiles.active}
        value={String(active.length)}
        note={t.tiles.activeNote(active.filter((i) => i.status === "improving").length)}
      />
      <div className="rounded-xl border bg-card p-4 text-card-foreground">
        <p className="text-sm text-muted-foreground">{t.tiles.checkedIn}</p>
        <p className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {`${checkedInToday}/${active.length}`}
        </p>
        {active.length > 0 ? (
          <button
            type="button"
            onClick={onCheckIn}
            className={cn(
              "mt-1 inline-flex items-center gap-0.5 rounded text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              allIn ? "text-success" : "text-primary",
            )}
          >
            {allIn ? t.tiles.checkInAgain : t.tiles.checkInNow}
            <ChevronRight aria-hidden className="size-4" />
          </button>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t.tiles.checkedInNote}</p>
        )}
      </div>
      <StatTile
        label={t.tiles.worst}
        value={worst ? t.scale(worst.level) : t.tiles.none}
        note={worst ? t.tiles.worstNote(worst.title) : undefined}
        tone={worst && worst.level >= 8 ? "warning" : "neutral"}
      />
      {/* Waiting suggestions: an amber tile that jumps to the plan. */}
      <a
        href="#health-plan"
        className={cn(
          "rounded-xl border p-4 text-card-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          waiting > 0 ? "border-warning/50 bg-warning/10" : "pointer-events-none bg-card",
        )}
        aria-disabled={waiting === 0 || undefined}
        tabIndex={waiting === 0 ? -1 : undefined}
      >
        <p className="text-sm text-muted-foreground">{t.tiles.plan}</p>
        <p className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {String(running)}
        </p>
        <p
          className={cn(
            "mt-1 flex items-center gap-0.5 text-sm font-medium",
            waiting > 0 ? "text-warning" : "text-muted-foreground",
          )}
        >
          {t.tiles.planNote(waiting)}
          {waiting > 0 && <ChevronRight aria-hidden className="size-4" />}
        </p>
      </a>
    </div>
  );
}

function Journal({ model, className }: { model: HealthModel; className?: string }) {
  const notes = [
    ...model.issues.flatMap((issue) =>
      model
        .checkInsFor(issue.id)
        .filter((c) => c.note.trim())
        .map((c) => ({
          key: c.id,
          date: c.date,
          label: `${issue.title} · ${t.scale(c.severity)}`,
          text: c.note,
        })),
    ),
    ...model.dayNotes.map((d) => ({
      key: `day-${d.date}`,
      date: d.date,
      label: t.journal.dayNote,
      text: d.note,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Panel title={t.journal.title} subtitle={t.journal.subtitle} className={className}>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.journal.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3 text-sm" data-testid="health-notes">
          {notes.slice(0, 12).map((n) => (
            <li key={n.key}>
              <p className="text-xs text-muted-foreground">
                {fmt(n.date)} · {n.label}
              </p>
              <p>{n.text}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/** The latest report values outside their normal range (from Health → Reports and values). */
function OutOfRange({ className }: { className?: string }) {
  const values = useLabValues();
  const series = labSeries(values.data ?? []);
  if (series.length === 0) return null;
  const off = series.filter((s) => s.status === "low" || s.status === "high");
  const o = t.reports.outOfRangePanel;
  return (
    <Panel title={o.title} className={className}>
      {off.length === 0 ? (
        <p className="text-sm text-muted-foreground">{o.empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm" data-testid="out-of-range">
          {off.map((s) => (
            <li key={s.name} className="text-warning">
              {o.line(
                s.name,
                `${formatNumber(s.latest.value)} ${s.unit}`.trim(),
                t.reports.values.status[s.status!].toLowerCase(),
              )}
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/health/reports"
        className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {o.open}
      </Link>
    </Panel>
  );
}

function SafetyPanel({ className }: { className?: string }) {
  const s = t.safety;
  return (
    <Panel title={s.title} className={className} tour="health-safety">
      <div className="flex gap-2.5 text-sm">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="flex flex-col gap-2">
          <p>{s.body}</p>
          <p className="font-medium">{s.lead}</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {s.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <p
        role="note"
        className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
      >
        <strong className="font-semibold">{s.urgentLead}</strong> {s.urgent}
      </p>
    </Panel>
  );
}
