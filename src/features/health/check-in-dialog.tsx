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
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import type { Concern, ConcernUpdate } from "@/data/schema";
import { parseIsoDate, type IsoDate } from "@/lib/core";
import { PainScale } from "./pain-scale";

const t = copy.pages.health.checkIn;
const dayFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "short",
});
const longDate = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return dayFormat.format(new Date(year, month - 1, day));
};

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

  // The last check-in before this day, to say "same as last time" or "2 better".
  const previous = [...checkIns].filter((c) => c.date < date).at(-1)?.severity;

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
          <p className="text-sm text-muted-foreground">{t.eyebrow(longDate(date))}</p>
          <DialogTitle>{issue.title}</DialogTitle>
          <DialogDescription className="sr-only">{t.title(issue.title)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold">{t.howNow}</p>
            <PainScale large label={t.levelOn(issue.title)} value={level} onChange={setLevel} />
            <p aria-hidden className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              {t.bands.map((b) => (
                <span key={b}>{b}</span>
              ))}
            </p>
            {level !== null && (
              <p
                aria-live="polite"
                className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm"
                data-testid="check-in-summary"
              >
                <strong className="font-semibold">
                  {level} · {copy.pages.health.scaleWords[level]}.
                </strong>{" "}
                {previous === undefined
                  ? t.firstCheckIn
                  : level === previous
                    ? t.same
                    : level < previous
                      ? t.better(previous - level)
                      : t.worse(level - previous)}
              </p>
            )}
          </div>
          <FormField label={t.note} htmlFor="check-in-note">
            <Textarea
              id="check-in-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
            />
          </FormField>
          <FormField label={t.date} htmlFor="check-in-date">
            <Input
              id="check-in-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && pickDate(e.target.value)}
              className="max-w-48"
            />
          </FormField>
          <p className="text-xs text-muted-foreground">{t.doctorHint}</p>
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
