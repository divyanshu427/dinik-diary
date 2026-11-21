"use client";

import { CalendarHeart, Feather, Plus, Stethoscope, TrendingUp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import type { Concern, HealthAdjustment } from "@/data/schema";
import { describeTarget } from "@/features/habits/format";
import type { HealthEditor } from "@/hooks/use-health";
import {
  isActiveAdjustment,
  parseIsoDate,
  type HealthSuggestion,
  type IsoDate,
  type Reason,
} from "@/lib/core";
import { cn } from "@/lib/utils";
import type { HealthModel } from "./use-health-model";

const p = copy.pages.health.plan;
const shortDate = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const fmt = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return shortDate.format(new Date(year, month - 1, day));
};

type Change = Extract<HealthSuggestion, { kind: "change" }>;

/** The plan's suggestions, grouped by issue, and the changes running now. */
export function PlanCard({
  model,
  editor,
  onAddHelper,
  onCheckIn,
  run,
}: {
  model: HealthModel;
  editor: HealthEditor;
  /** Opens the check-in for an issue. */
  onCheckIn: (issue: Concern) => void;
  onAddHelper: (
    issue: Concern,
    suggestion: Extract<HealthSuggestion, { kind: "add-helper" }>,
  ) => void;
  run: (work: Promise<unknown>) => void;
}) {
  const { today, suggestions, habitById } = model;
  const issueById = new Map(model.issues.map((i) => [i.id, i]));
  const habitTarget = new Map(model.advisorHabits.map((h) => [h.id, h.target]));

  const running: { issue: Concern; adjustment: HealthAdjustment }[] = model.issues.flatMap(
    (issue) =>
      issue.adjustments
        .filter((a) => isActiveAdjustment(a, today))
        .map((adjustment) => ({ issue, adjustment })),
  );

  const latestLevel = (issueId: string) => model.checkInsFor(issueId).at(-1)?.severity ?? 0;

  const changeText = (s: Change) => {
    const habit = habitById.get(s.habitId)!;
    const c = s.change;
    if (c.mode === "pause") return p.change.pause(habit.name, s.days);
    const from = describeTarget(habit, habitTarget.get(habit.id));
    const to = describeTarget(habit, c.values);
    return p.change[c.mode](habit.name, from, to, s.days);
  };

  const reasonText = (r: Reason, issue: Concern) => {
    switch (r.source) {
      case "usual":
        return p.reasons.usual[r.role](issue.title);
      case "you":
        return p.reasons.you[r.role];
      case "after":
        return p.reasons.after(issue.title, r.withHabit, r.without);
      case "lower":
        return p.reasons.lower(issue.title, r.withHabit, r.without);
      case "recent":
        return p.reasons.recent(r.done, r.of);
    }
  };

  const mainText = (s: HealthSuggestion) => {
    const issue = issueById.get(s.issueId)!;
    switch (s.kind) {
      case "see-doctor":
        return s.reason === "high"
          ? p.seeDoctor.high(issue.title, s.latest)
          : p.seeDoctor.worsening(issue.title);
      case "change":
        return changeText(s);
      case "add-helper":
        return s.name
          ? p.addHelperYours(s.name)
          : p.addHelper(copy.pages.health.library[s.profile!].helper, issue.title);
      case "sick-day":
        return p.sickDay;
      case "back-to-normal":
        return p.backToNormal(issue.title);
    }
  };

  const approve = (s: HealthSuggestion) => {
    const issue = issueById.get(s.issueId)!;
    switch (s.kind) {
      case "change":
        return editor.applyChange.mutateAsync([s.issueId, s.habitId, s.change, s.days]);
      case "add-helper":
        onAddHelper(issue, s);
        return Promise.resolve();
      case "sick-day":
        return editor.markSickDay.mutateAsync([today]);
      case "back-to-normal":
        return (async () => {
          for (const id of s.adjustmentIds) await editor.endAdjustment.mutateAsync([s.issueId, id]);
        })();
      case "see-doctor":
        return editor.dismiss.mutateAsync([s.issueId, s.key]);
    }
  };

  const actionLabel = (s: HealthSuggestion) =>
    s.kind === "add-helper"
      ? p.addHelperAction
      : s.kind === "sick-day"
        ? p.sickDayAction
        : s.kind === "back-to-normal"
          ? p.backToNormalAction
          : s.kind === "see-doctor"
            ? p.seeDoctor.ok
            : p.approve;

  const icon = (s: HealthSuggestion) => {
    const I =
      s.kind === "see-doctor"
        ? Stethoscope
        : s.kind === "change"
          ? s.change.mode === "raise"
            ? TrendingUp
            : Feather
          : s.kind === "add-helper"
            ? Plus
            : s.kind === "sick-day"
              ? CalendarHeart
              : Undo2;
    return (
      <I
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          s.kind === "see-doctor" ? "text-destructive" : "text-primary",
        )}
      />
    );
  };

  // Group by issue, in the order the advisor gave (doctor first).
  const groups: { issue: Concern; items: HealthSuggestion[] }[] = [];
  for (const s of suggestions) {
    const issue = issueById.get(s.issueId)!;
    const group = groups.find((g) => g.issue.id === issue.id);
    if (group) group.items.push(s);
    else groups.push({ issue, items: [s] });
  }

  // Issues without a check-in today: the plan works from how it is today.
  const notCheckedIn = model.active.filter(
    (i) => !model.checkInsFor(i.id).some((c) => c.date === today),
  );

  return (
    <div className="flex flex-col gap-5">
      {notCheckedIn.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="check-in-reminder">
          {notCheckedIn.map((issue) => (
            <li
              key={issue.id}
              className="flex flex-col gap-2 rounded-xl border border-dashed border-primary/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{p.checkInFirst(issue.title)}</span>
              <Button size="sm" variant="outline" onClick={() => onCheckIn(issue)}>
                {p.checkInAction}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {model.hidden.length ? p.emptyAnswered : p.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-5" data-testid="suggestions">
          {groups.map(({ issue, items }) => {
            const changes = items.filter((s): s is Change => s.kind === "change");
            return (
              <section key={issue.id} aria-label={issue.title} data-plan-for={issue.title}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    {p.forIssue(issue.title, latestLevel(issue.id))}
                  </h3>
                  {changes.length >= 2 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        run(
                          (async () => {
                            for (const c of changes) await approve(c);
                          })(),
                        )
                      }
                    >
                      {p.applyAll(changes.length)}
                    </Button>
                  )}
                </div>
                <ul className="flex flex-col gap-2">
                  {items.map((s) => (
                    <li
                      key={s.key}
                      data-suggestion={s.kind}
                      data-habit={s.kind === "change" ? habitById.get(s.habitId)?.name : undefined}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                        s.kind === "see-doctor" && "border-destructive/50",
                      )}
                    >
                      <div className="flex items-start gap-2.5 text-sm">
                        {icon(s)}
                        <div>
                          <p className="font-medium">{mainText(s)}</p>
                          {s.kind === "change" && (
                            <ul className="mt-0.5 text-muted-foreground">
                              {s.reasons.map((r, i) => (
                                <li key={i}>{reasonText(r, issue)}</li>
                              ))}
                              <li>{p.goesBack}</li>
                            </ul>
                          )}
                        </div>
                      </div>
                      {/* Phones: two big buttons side by side. */}
                      <div className="flex shrink-0 gap-2 max-sm:grid max-sm:grid-cols-2 sm:pl-0">
                        <Button
                          size="sm"
                          variant={s.kind === "see-doctor" ? "outline" : "default"}
                          onClick={() => run(approve(s))}
                          className="max-sm:h-11 max-sm:text-base"
                        >
                          {actionLabel(s)}
                        </Button>
                        {s.kind !== "see-doctor" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="max-sm:h-11 max-sm:text-base"
                            onClick={() => run(editor.dismiss.mutateAsync([s.issueId, s.key]))}
                          >
                            {p.notNow}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {model.hidden.length > 0 && (
        <details className="group rounded-xl border px-3 py-2" data-testid="hidden-suggestions">
          <summary className="cursor-pointer text-sm font-medium">
            {p.hidden(model.hidden.length)}
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">{p.hiddenHint}</p>
          <ul className="mt-2 flex flex-col divide-y text-sm">
            {model.hidden.map((s) => (
              <li
                key={s.key}
                data-suggestion={s.kind}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="text-muted-foreground">{mainText(s)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => run(editor.undismiss.mutateAsync([s.issueId, s.key]))}
                >
                  {p.showAgain}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {running.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{p.running}</h3>
          <ul className="flex flex-col divide-y rounded-xl border" data-testid="running">
            {running.map(({ issue, adjustment: a }) => {
              const habit = habitById.get(a.habitId);
              const change =
                !habit || a.kind === "pause" || !a.eased
                  ? p.paused
                  : describeTarget(habit, a.eased);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span>
                    {p.adjustment(habit?.name ?? "?", change, fmt(a.to))}
                    <span className="text-muted-foreground"> · {issue.title}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={p.endNowFor(habit?.name ?? "?")}
                    onClick={() => run(editor.endAdjustment.mutateAsync([issue.id, a.id]))}
                  >
                    {p.endNow}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
