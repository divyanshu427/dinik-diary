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
import { copy } from "@/copy";
import type { LabValueDraft } from "@/data/report-ops";
import { labKey, type IsoDate, type LabSeries } from "@/lib/core";

const r = copy.pages.health.reports;
const f = r.form;
const v = r.valueForm;
const num = (s: string) => (s.trim() === "" ? null : Number(s));

/** A value measured without a report (e.g. blood pressure at home). */
export function ValueDialog({
  series,
  today,
  onSubmit,
  onClose,
}: {
  series: readonly LabSeries[];
  today: IsoDate;
  onSubmit: (date: IsoDate, draft: LabValueDraft) => Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fillFromHistory = () => {
    const known = series.find((s) => labKey(s.name) === labKey(name));
    if (!known) return;
    const l = known.latest;
    if (!unit) setUnit(l.unit);
    if (!low && l.low !== null) setLow(String(l.low));
    if (!high && l.high !== null) setHigh(String(l.high));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = num(value);
    const bad = (s: string) => s.trim() !== "" && !Number.isFinite(Number(s));
    if (!name.trim() || n === null || !Number.isFinite(n) || bad(low) || bad(high)) {
      setError(f.valueInvalid(1));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(date, { name, value: n, unit, low: num(low), high: num(high), note });
      onClose();
    } catch (err) {
      setError(copy.pages.health.failed(err instanceof Error ? err.message : String(err)));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{v.title}</DialogTitle>
          <DialogDescription>{v.hint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <datalist id="known-values-single">
            {series.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <FormField label={f.valueName} htmlFor="value-name">
              <Input
                id="value-name"
                list="known-values-single"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={fillFromHistory}
                placeholder={f.valueNamePlaceholder}
                autoComplete="off"
              />
            </FormField>
            <FormField label={v.date} htmlFor="value-date">
              <Input
                id="value-date"
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FormField label={f.value} htmlFor="value-value">
              <Input
                id="value-value"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </FormField>
            <FormField label={f.unit} htmlFor="value-unit">
              <Input
                id="value-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                autoComplete="off"
              />
            </FormField>
            <FormField label={f.low} htmlFor="value-low">
              <Input
                id="value-low"
                inputMode="decimal"
                value={low}
                onChange={(e) => setLow(e.target.value)}
              />
            </FormField>
            <FormField label={f.high} htmlFor="value-high">
              <Input
                id="value-high"
                inputMode="decimal"
                value={high}
                onChange={(e) => setHigh(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={v.note} htmlFor="value-note">
            <Input
              id="value-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoComplete="off"
            />
          </FormField>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {v.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {v.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
