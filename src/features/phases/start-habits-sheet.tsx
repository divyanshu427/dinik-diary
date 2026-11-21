"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import type { Habit } from "@/data/schema";
import { formatShort } from "@/features/today/format";
import { addDays, type IsoDate } from "@/lib/core";
import { cn } from "@/lib/utils";

const t = copy.pages.start;
type When = "today" | "later" | "date";
const LATER_DAYS = 4;

export interface StartChoice {
  habitIds: string[];
  from: IsoDate;
  applyUpgrades: boolean;
}

/**
 * "Start Phase 2": tick the habits to begin with and pick when they start. The others wait
 * in the phase until you start them. Also used for "Choose more habits".
 */
export function StartHabitsSheet({
  title,
  note,
  habits,
  detail,
  initial = [],
  upgrades = [],
  today,
  onSubmit,
  onClose,
}: {
  title: string;
  /** An extra line under the hint, e.g. "You haven't reached 80% yet…". */
  note?: string;
  habits: readonly Habit[];
  /** The right-hand text of a row: "30 min", "3 times a week", "every day". */
  detail: (habit: Habit) => string;
  /** Ticked when the sheet opens. */
  initial?: readonly string[];
  /** Target changes that come with the phase ("Daily steps from 5,000 steps to 8,000 steps"). */
  upgrades?: readonly string[];
  today: IsoDate;
  onSubmit: (choice: StartChoice) => Promise<unknown>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial));
  const [applyUpgrades, setApplyUpgrades] = useState(true);
  const [when, setWhen] = useState<When>("today");
  const [date, setDate] = useState(addDays(today, 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = habits.length;
  const min = Math.min(2, total);
  const max = Math.min(3, total);
  const from = when === "today" ? today : when === "later" ? addDays(today, LATER_DAYS) : date;
  const allPicked = picked.size === total && total > 0;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      // Keep the phase's order.
      await onSubmit({
        habitIds: habits.filter((h) => picked.has(h.id)).map((h) => h.id),
        from,
        applyUpgrades,
      });
      onClose();
    } catch (e) {
      setError(copy.pages.habits.failed(e instanceof Error ? e.message : String(e)));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t.hint}</DialogDescription>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
            data-testid="start-picked"
          >
            {t.picked(picked.size, total, min, max)}
          </span>
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => setPicked(allPicked ? new Set() : new Set(habits.map((h) => h.id)))}
          >
            {allPicked ? t.clear : t.selectAll}
          </Button>
        </div>

        <ul className="-mx-1 divide-y border-y" aria-label={title}>
          {habits.map((habit) => {
            const on = picked.has(habit.id);
            return (
              <li key={habit.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(habit.id)}
                  className="flex w-full items-center gap-3 px-1 py-3 text-left outline-none focus-visible:bg-muted"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {on && <Check className="size-4" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 text-base">{habit.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{detail(habit)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {upgrades.length > 0 && (
          <button
            type="button"
            role="checkbox"
            aria-checked={applyUpgrades}
            onClick={() => setApplyUpgrades((v) => !v)}
            className="flex items-start gap-3 rounded-xl bg-muted/60 px-3 py-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2",
                applyUpgrades
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input",
              )}
            >
              {applyUpgrades && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className="flex flex-col gap-0.5">
              {upgrades.map((u) => (
                <span key={u}>{t.upgrade(u)}</span>
              ))}
            </span>
          </button>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold">{t.when}</p>
          <div role="radiogroup" aria-label={t.when} className="grid grid-cols-3 gap-2">
            {(
              [
                ["today", t.today],
                ["later", t.inDays(LATER_DAYS)],
                ["date", t.pickDate],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={when === value}
                onClick={() => setWhen(value)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  when === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {when === "date" && (
            <Input
              type="date"
              aria-label={t.dateLabel}
              value={date}
              min={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="mt-2 h-10 max-w-48"
            />
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t.footnote(formatShort(from))}</p>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button disabled={saving || picked.size === 0} onClick={submit}>
            {t.submit(picked.size)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
