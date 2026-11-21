"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "@/components/form-field";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { copy } from "@/copy";
import type { Habit, HabitTarget, TargetUpgrade } from "@/data/schema";
import { describeTarget, unitFor } from "@/features/habits/format";
import { targetOn, type IsoDate } from "@/lib/core";

const t = copy.pages.phases.upgradeDialog;

interface UpgradeDialogProps {
  phaseLabel: string;
  /** Habits that can get a new target: measured ones, not archived, from other phases. */
  habits: readonly Habit[];
  targetsByHabit: ReadonlyMap<string, readonly HabitTarget[]>;
  today: IsoDate;
  onSubmit: (upgrade: TargetUpgrade) => Promise<unknown>;
  onClose: () => void;
}

/** Pick a habit and the target it gets when this phase is enabled. */
export function UpgradeDialog({
  phaseLabel,
  habits,
  targetsByHabit,
  today,
  onSubmit,
  onClose,
}: UpgradeDialogProps) {
  const [habitId, setHabitId] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const habit = habits.find((h) => h.id === habitId);
  const current = habit ? targetOn(targetsByHabit.get(habit.id) ?? [], today) : undefined;
  const isTime = habit?.type === "time";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const number = Number(value);
    const ok = habit && value.trim() !== "" && (isTime ? /^\d{2}:\d{2}$/.test(value) : number >= 0);
    if (!ok) {
      setError(t.required);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        habitId: habit.id,
        targetValue: isTime ? null : number,
        targetTime: isTime ? value : null,
        graceMinutes: isTime ? (current?.graceMinutes ?? 0) : 0,
      });
      onClose();
    } catch (err) {
      setError(copy.pages.phases.failed(err instanceof Error ? err.message : String(err)));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title(phaseLabel)}</DialogTitle>
          <DialogDescription>{t.hint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField label={t.habit} htmlFor="upgrade-habit">
            <NativeSelect
              id="upgrade-habit"
              value={habitId}
              onChange={(e) => {
                setHabitId(e.target.value);
                setValue("");
              }}
              className="w-full"
            >
              <NativeSelectOption value="" disabled>
                {t.pick}
              </NativeSelectOption>
              {habits.map((h) => (
                <NativeSelectOption key={h.id} value={h.id}>
                  {h.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          {habit && (
            <FormField
              label={isTime ? t.time : `${t.value} (${unitFor(habit) || "#"})`}
              htmlFor="upgrade-value"
            >
              <Input
                id="upgrade-value"
                type={isTime ? "time" : "number"}
                inputMode={isTime ? undefined : "decimal"}
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t.current(describeTarget(habit, current))}
              </p>
            </FormField>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
