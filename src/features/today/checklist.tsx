"use client";

import { Check, MessageSquarePlus, Minus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import type { Habit, HabitLog, HabitTarget, PartOfDay } from "@/data/schema";
import { describeTarget, unitFor } from "@/features/habits/format";
import { minutesIntoDay, quickAmounts, type Entry, type Score, type Streak } from "@/lib/core";
import { cn } from "@/lib/utils";
import { formatClock, formatNumber } from "./format";

const t = copy.pages.today;

export interface CheckRowModel {
  habit: Habit;
  target: HabitTarget | undefined;
  log: HabitLog | undefined;
  score: Score;
  streak?: Streak;
  /** "N times a week" habits: how many this week so far. */
  weekly?: { done: number; times: number };
  /** Evening/night habit on today, before that part of the day: "Tonight". */
  later?: "evening" | "night" | null;
}

interface RowActions {
  /** Saves what was logged (null clears it). */
  onLog: (habit: Habit, entry: Entry | null) => void;
  onNote: (habit: Habit, log: HabitLog) => void;
  /** Current time "HH:mm" for "Now" and the logged time of ticks (null when not today). */
  nowTime: string | null;
  dayStartHour: number;
}

export const GROUP_ORDER: readonly PartOfDay[] = [
  "morning",
  "anytime",
  "afternoon",
  "evening",
  "night",
];

/** One part-of-day group: "Morning 3/5" and its rows. */
export function CheckGroup({
  part,
  rows,
  ...actions
}: { part: PartOfDay; rows: CheckRowModel[] } & RowActions) {
  const done = rows.filter((r) => r.score.done).length;
  const id = `group-${part}`;
  return (
    <section aria-labelledby={id}>
      <h3
        id={id}
        className="flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        <span>{t.groups[part]}</span>
        <span className="tabular-nums">{t.groupCount(done, rows.length)}</span>
      </h3>
      <ul className="divide-y">
        {rows.map((row) => (
          <CheckRow key={row.habit.id} row={row} {...actions} />
        ))}
      </ul>
    </section>
  );
}

function CheckRow({
  row,
  onLog,
  onNote,
  nowTime,
  dayStartHour,
}: { row: CheckRowModel } & RowActions) {
  const { habit, log, score, target } = row;
  const partial = !score.done && score.progress > 0;
  const keepTime = log?.time ?? nowTime;

  // Amounts show their target in the controls; time habits show "By 07:30" here.
  const subline = [
    habit.type === "time" ? describeTarget(habit, target) : null,
    row.weekly ? t.weekly(row.weekly.done, row.weekly.times) : null,
    row.streak && row.streak.current >= 2
      ? t.streakBadge(row.streak.current, row.streak.unit)
      : null,
    log?.note ? `“${log.note}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
      data-habit-row={habit.name}
    >
      {habit.type === "boolean" ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={score.done}
          aria-label={habit.name}
          onClick={() => onLog(habit, score.done ? null : { value: 1, time: nowTime })}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            score.done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:border-primary",
          )}
        >
          {score.done && <Check aria-hidden className="size-4" strokeWidth={3} />}
        </button>
      ) : (
        <StatusDot done={score.done} partial={partial} />
      )}

      <div className="min-w-[10rem] flex-1">
        <p className="font-medium" data-habit-name>
          {habit.name}
        </p>
        {subline && <p className="text-sm text-muted-foreground">{subline}</p>}
      </div>

      {/* Rows with controls wrap them onto their own line on phones; plain ticks keep their time beside the name. */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-end gap-2",
          habit.type === "boolean" ? "ml-auto" : "w-full pl-10 sm:w-auto sm:pl-0",
        )}
      >
        {habit.type === "count" && (
          <Stepper
            habit={habit}
            value={log?.value ?? 0}
            target={target?.targetValue ?? null}
            partial={partial}
            onChange={(v) => onLog(habit, v <= 0 ? null : { value: v, time: keepTime })}
          />
        )}
        {(habit.type === "duration" || habit.type === "numeric") && (
          <AmountControl
            habit={habit}
            value={log?.value ?? null}
            target={target?.targetValue ?? null}
            partial={partial}
            onChange={(v) => onLog(habit, v === null ? null : { value: v, time: keepTime })}
          />
        )}
        {habit.type === "time" && (
          <TimeControl
            habit={habit}
            value={log?.time ?? null}
            nowTime={nowTime}
            onChange={(time) => onLog(habit, time ? { value: null, time } : null)}
          />
        )}

        <Meta row={row} dayStartHour={dayStartHour} />

        {log && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.note.add(habit.name)}
            onClick={() => onNote(habit, log)}
          >
            <MessageSquarePlus aria-hidden />
          </Button>
        )}
      </div>
    </li>
  );
}

/** Right-hand info: logged time, lateness, or "Tonight". */
function Meta({ row, dayStartHour }: { row: CheckRowModel; dayStartHour: number }) {
  const { habit, log, target, score, later } = row;
  let text: string | null = null;
  let warn = false;

  if (habit.type === "time" && log?.time) {
    const lateBy =
      target?.targetTime != null
        ? minutesIntoDay(log.time, dayStartHour) - minutesIntoDay(target.targetTime, dayStartHour)
        : 0;
    text = lateBy > 0 ? t.late(lateBy) : t.onTime;
    warn = lateBy > 0;
  } else if (log?.time && score.done) {
    text = formatClock(log.time);
  } else if (!score.done && later) {
    text = later === "night" ? t.tonight : t.thisEvening;
  }

  if (!text) return null;
  return (
    <span
      className={cn("text-sm whitespace-nowrap", warn ? "text-warning" : "text-muted-foreground")}
    >
      {text}
    </span>
  );
}

function StatusDot({ done, partial }: { done: boolean; partial: boolean }) {
  const label = done ? t.status.done : partial ? t.status.partial : t.status.notDone;
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
        done && "border-primary bg-primary text-primary-foreground",
        partial && "border-warning",
        !done && !partial && "border-input",
      )}
    >
      {done && <Check aria-hidden className="size-4" strokeWidth={3} />}
      {partial && <span aria-hidden className="size-2.5 rounded-full bg-warning" />}
    </span>
  );
}

function AmountText({
  habit,
  value,
  target,
  partial,
}: {
  habit: Habit;
  value: number | null;
  target: number | null;
  partial: boolean;
}) {
  const unit = unitFor(habit);
  const v = formatNumber(value ?? 0);
  const text =
    target === null
      ? `${v} ${unit}`.trim()
      : habit.direction === "lower_better"
        ? t.amountAtMost(v, formatNumber(target), unit)
        : t.amount(v, formatNumber(target), unit);
  return (
    <span className={cn("text-sm font-medium tabular-nums", partial && "text-warning")}>
      {text}
    </span>
  );
}

function Stepper({
  habit,
  value,
  target,
  partial,
  onChange,
}: {
  habit: Habit;
  value: number;
  target: number | null;
  partial: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t.decrease(habit.name)}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden />
      </Button>
      <AmountText habit={habit} value={value} target={target} partial={partial} />
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t.increase(habit.name)}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden />
      </Button>
    </span>
  );
}

function AmountControl({
  habit,
  value,
  target,
  partial,
  onChange,
}: {
  habit: Habit;
  value: number | null;
  target: number | null;
  partial: boolean;
  onChange: (value: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [a, b] = quickAmounts(habit.type as "duration" | "numeric", target);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    onChange(trimmed === "" ? null : Math.max(0, Number(trimmed)));
    setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={submit} className="flex items-center gap-1.5">
        <Input
          autoFocus
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          aria-label={t.totalLabel(habit.name)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 w-28"
        />
        <Button type="submit" size="sm">
          {t.save}
        </Button>
      </form>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <AmountText habit={habit} value={value} target={target} partial={partial} />
      {[a, b].map((n) => (
        <Button
          key={n}
          variant="outline"
          size="sm"
          aria-label={t.addAmount(formatNumber(n), habit.name)}
          onClick={() => onChange((value ?? 0) + n)}
        >
          +{formatNumber(n)}
        </Button>
      ))}
      <Button
        size="sm"
        onClick={() => {
          setDraft(value === null ? "" : String(value));
          setEditing(true);
        }}
      >
        {t.enterTotal}
      </Button>
    </span>
  );
}

function TimeControl({
  habit,
  value,
  nowTime,
  onChange,
}: {
  habit: Habit;
  value: string | null;
  nowTime: string | null;
  onChange: (time: string | null) => void;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Input
        type="time"
        aria-label={t.timeLabel(habit.name)}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 w-32"
      />
      {nowTime && (
        <Button
          variant="outline"
          size="sm"
          aria-label={t.setNow(habit.name)}
          onClick={() => onChange(nowTime)}
        >
          {t.now}
        </Button>
      )}
    </span>
  );
}
