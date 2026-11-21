"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import type { Concern, ConcernUpdate } from "@/data/schema";
import type { IsoDate } from "@/lib/core";
import { PainScale } from "./pain-scale";

const t = copy.pages.health.checkIn;

/** Record how an issue is on a day (today, or an earlier day). */
export function CheckInDialog({
  issue,
  checkIns,
  today,
  onSubmit,
  onClose,
}: {
  issue: Concern;
  checkIns: readonly ConcernUpdate[];
  today: IsoDate;
  onSubmit: (date: IsoDate, severity: number, note: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const existing = (date: IsoDate) => checkIns.find((c) => c.date === date);
  const [date, setDate] = useState(today);
  const [level, setLevel] = useState<number | null>(existing(today)?.severity ?? null);
  const [note, setNote] = useState(existing(today)?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickDate = (d: IsoDate) => {
    setDate(d);
    setLevel(existing(d)?.severity ?? null);
    setNote(existing(d)?.note ?? "");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (level === null) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(date, level, note);
      onClose();
    } catch (err) {
      setError(copy.pages.health.failed(err instanceof Error ? err.message : String(err)));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title(issue.title)}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField label={t.date} htmlFor="check-in-date">
            <Input
              id="check-in-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && pickDate(e.target.value)}
            />
          </FormField>
          <FormField label={t.levelOn(issue.title)}>
            <PainScale label={t.levelOn(issue.title)} value={level} onChange={setLevel} />
          </FormField>
          <FormField label={t.note} htmlFor="check-in-note">
            <Textarea
              id="check-in-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
            />
          </FormField>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={saving || level === null}>
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
