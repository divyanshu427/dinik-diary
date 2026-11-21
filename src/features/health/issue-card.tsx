"use client";

import { Activity, ChevronRight, CircleCheck, Pencil, Trash2, TrendingDown } from "lucide-react";
import { ActionMenu } from "@/components/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import type { Concern, ConcernUpdate, Habit } from "@/data/schema";
import {
  addDays,
  eachDay,
  healthTrend,
  parseIsoDate,
  type HabitRoleInfo,
  type IsoDate,
} from "@/lib/core";
import { cn } from "@/lib/utils";

const t = copy.pages.health;
const i18 = t.issue;
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const fmt = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return shortDate.format(new Date(year, month - 1, day));
};

interface IssueCardProps {
  issue: Concern;
  checkIns: readonly ConcernUpdate[];
  today: IsoDate;
  habitById: ReadonlyMap<string, Habit>;
  /** Which checklist habits matter for this issue, and why (from the advisor). */
  roles: ReadonlyMap<string, HabitRoleInfo>;
  onCheckIn: () => void;
  onEdit: () => void;
  onStatus: (status: Concern["status"]) => void;
  onDelete: () => void;
  onDeleteCheckIn: (id: string) => void;
}

/** One health issue: latest level, 14-day chart, trend, what helps, check-in history. */
export function IssueCard({
  issue,
  checkIns,
  today,
  habitById,
  roles,
  onCheckIn,
  onEdit,
  onStatus,
  onDelete,
  onDeleteCheckIn,
}: IssueCardProps) {
  const latest = checkIns.at(-1);
  const points = checkIns.map((c) => ({ date: c.date, severity: c.severity }));
  const trend = healthTrend(points, today);
  const byDate = new Map(checkIns.map((c) => [c.date, c.severity]));
  const days = eachDay(addDays(today, -13), today);
  const titleId = `issue-${issue.id}`;

  // Patterns in my own data, e.g. "4/10 on days you did Stretching, 6.5/10 otherwise".
  const patterns = [...roles].flatMap(([habitId, info]) =>
    info.reasons
      .filter((r) => r.source === "lower" || r.source === "after")
      .map((r) => ({ habit: habitById.get(habitId)?.name ?? "?", reason: r })),
  );
  const watching = (role: "strain" | "helps") =>
    [...roles]
      .filter(([, info]) => (role === "strain" ? info.role === "strain" : info.role !== "strain"))
      .map(([id]) => habitById.get(id)?.name)
      .filter(Boolean)
      .join(", ");

  const trendText =
    trend.recent === null
      ? null
      : trend.before === null || Math.abs(trend.recent - trend.before) < 1
        ? i18.trendSame(trend.recent)
        : trend.recent < trend.before
          ? i18.trendDown(trend.before, trend.recent)
          : i18.trendUp(trend.before, trend.recent);

  const details: [string, string][] = (
    [
      [i18.worse, issue.worseWith],
      [i18.helps, issue.helpsWith],
      [i18.tried, issue.triedSoFar],
      [i18.helpingHabits, watching("helps")],
      [i18.strainHabits, watching("strain")],
    ] as [string, string][]
  ).filter(([, value]) => value.trim());

  return (
    <section
      aria-labelledby={titleId}
      data-issue={issue.title}
      data-tour="health-issue"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 text-card-foreground"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="font-heading text-lg font-semibold">
            {issue.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {[issue.bodyArea, i18.since(fmt(issue.startedAt))].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">{t.kinds[issue.kind]}</Badge>
            <Badge variant={issue.status === "active" ? "secondary" : "outline"}>
              {t.statuses[issue.status]}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" onClick={onCheckIn} className="max-sm:hidden">
            {i18.checkIn}
          </Button>
          <ActionMenu
            label={i18.more(issue.title)}
            title={issue.title}
            subtitle={t.kinds[issue.kind]}
            items={[
              { label: i18.edit, description: i18.editHint, icon: Pencil, onSelect: onEdit },
              ...(issue.status !== "improving"
                ? [
                    {
                      label: i18.markImproving,
                      description: i18.improvingHint,
                      icon: TrendingDown,
                      onSelect: () => onStatus("improving"),
                    },
                  ]
                : []),
              ...(issue.status !== "active"
                ? [
                    {
                      label: i18.markActive,
                      description: i18.activeHint,
                      icon: Activity,
                      onSelect: () => onStatus("active"),
                    },
                  ]
                : []),
              ...(issue.status !== "resolved"
                ? [
                    {
                      label: i18.markResolved,
                      description: i18.resolvedHint,
                      icon: CircleCheck,
                      onSelect: () => onStatus("resolved"),
                    },
                  ]
                : []),
              {
                label: i18.delete,
                description: i18.deleteHint,
                icon: Trash2,
                destructive: true,
                separatorBefore: true,
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      </div>

      <div className="flex items-end gap-4">
        <div className="shrink-0">
          <p className="text-xs text-muted-foreground">{i18.latest}</p>
          <p
            className={cn(
              "font-heading text-3xl font-semibold tabular-nums",
              latest && latest.severity >= 8 && "text-destructive",
            )}
            data-testid="issue-latest"
          >
            {latest ? t.scale(latest.severity) : "—"}
          </p>
          {latest && (
            <p className="text-xs text-muted-foreground">{t.scaleWords[latest.severity]}</p>
          )}
        </div>
        {/* 14-day bars (the check-in list below has the same data as text). */}
        <div
          role="img"
          aria-label={`${i18.chart(issue.title)}: ${days
            .filter((d) => byDate.has(d))
            .map((d) => `${fmt(d)} ${byDate.get(d)}`)
            .join(", ")}`}
          className="flex h-14 flex-1 items-end gap-0.5"
        >
          {days.map((d) => {
            const v = byDate.get(d);
            return (
              <span
                key={d}
                title={v === undefined ? fmt(d) : `${fmt(d)}: ${v}/10`}
                className={cn(
                  "flex-1 rounded-t-sm",
                  v === undefined ? "h-0.5 bg-muted" : v >= 8 ? "bg-destructive" : "bg-primary",
                  d === today && v !== undefined && "opacity-80",
                )}
                style={v === undefined ? undefined : { height: `${Math.max(6, v * 10)}%` }}
              />
            );
          })}
        </div>
      </div>

      {latest && latest.severity >= 8 && (
        <p
          role="note"
          className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive"
          data-testid="doctor-note"
        >
          {i18.doctorNote}
        </p>
      )}

      {(trendText || patterns.length > 0) && (
        <div className="flex flex-col gap-0.5 text-sm">
          {trendText && <p className="font-medium">{trendText}</p>}
          {patterns.map(({ habit, reason: r }) =>
            r.source === "lower" || r.source === "after" ? (
              <p
                key={`${habit}-${r.source}`}
                className="text-muted-foreground"
                data-testid="issue-pattern"
              >
                {r.source === "lower"
                  ? i18.effect(habit, r.withHabit, r.without)
                  : i18.effectAfter(habit, r.withHabit, r.without)}
              </p>
            ) : null,
          )}
        </div>
      )}

      {details.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Phones: one big button (the header has a small one on wider screens). */}
      <Button onClick={onCheckIn} className="h-12 w-full rounded-xl text-base sm:hidden">
        {i18.checkIn}
      </Button>

      <details className="group border-t pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
          {i18.history} ({checkIns.length})
        </summary>
        {checkIns.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{i18.noCheckIns}</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y text-sm" data-testid="check-ins">
            {[...checkIns].reverse().map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 py-1.5">
                <span className="w-16 shrink-0 text-muted-foreground">{fmt(c.date)}</span>
                <span className="w-10 shrink-0 font-medium tabular-nums">
                  {t.scale(c.severity)}
                </span>
                <span className="min-w-0 flex-1 text-muted-foreground">{c.note}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={i18.removeCheckIn(fmt(c.date))}
                  onClick={() => onDeleteCheckIn(c.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
