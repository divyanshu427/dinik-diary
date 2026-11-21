"use client";

import { FileText, Paperclip, Plus, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { MAX_REPORT_FILE_BYTES, type NewReportFile, type ReportDraft } from "@/data/report-ops";
import type { Concern, HealthReport, LabValue, ReportFile, ReportType } from "@/data/schema";
import { labKey, type IsoDate, type LabSeries } from "@/lib/core";
import { formatBytes, isAcceptedFile, readAsDataUrl } from "./files";

const r = copy.pages.health.reports;
const f = r.form;
const TYPES = Object.keys(r.types) as ReportType[];

interface ValueRow {
  id?: string;
  name: string;
  value: string;
  unit: string;
  low: string;
  high: string;
  note: string;
}

const emptyRow = (): ValueRow => ({ name: "", value: "", unit: "", low: "", high: "", note: "" });
const num = (s: string) => (s.trim() === "" ? null : Number(s));

interface ReportDialogProps {
  /** The report to edit, or null to add one. */
  report: HealthReport | null;
  files: readonly ReportFile[];
  values: readonly LabValue[];
  issues: readonly Concern[];
  /** Earlier values, to suggest names and fill in the unit and range. */
  series: readonly LabSeries[];
  today: IsoDate;
  onSubmit: (draft: ReportDraft) => Promise<unknown>;
  onClose: () => void;
}

/** Add or edit a report: details, photos/PDFs, and the values typed from it. */
export function ReportDialog({
  report,
  files,
  values,
  issues,
  series,
  today,
  onSubmit,
  onClose,
}: ReportDialogProps) {
  const [title, setTitle] = useState(report?.title ?? "");
  const [type, setType] = useState<ReportType>(report?.type ?? "blood-test");
  const [date, setDate] = useState(report?.date ?? today);
  const [doctor, setDoctor] = useState(report?.doctor ?? "");
  const [notes, setNotes] = useState(report?.notes ?? "");
  const [concernIds, setConcernIds] = useState<string[]>(report?.concernIds ?? []);
  const [kept, setKept] = useState(files.map((x) => x.id));
  const [added, setAdded] = useState<NewReportFile[]>([]);
  const [rows, setRows] = useState<ValueRow[]>(
    values.length
      ? values.map((v) => ({
          id: v.id,
          name: v.name,
          value: String(v.value),
          unit: v.unit,
          low: v.low === null ? "" : String(v.low),
          high: v.high === null ? "" : String(v.high),
          note: v.note,
        }))
      : [emptyRow()],
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const setRow = (i: number, patch: Partial<ValueRow>) =>
    setRows((old) => old.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  /** A name used before: fill in its unit and range (from my own earlier value). */
  const fillFromHistory = (i: number) => {
    const row = rows[i];
    const known = series.find((s) => labKey(s.name) === labKey(row.name));
    if (!known) return;
    const l = known.latest;
    setRow(i, {
      unit: row.unit || l.unit,
      low: row.low || (l.low === null ? "" : String(l.low)),
      high: row.high || (l.high === null ? "" : String(l.high)),
    });
  };

  const chooseFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(e.target.files ?? [])];
    e.target.value = "";
    const problems: string[] = [];
    const next: NewReportFile[] = [];
    for (const file of chosen) {
      if (!isAcceptedFile(file)) problems.push(f.wrongType(file.name));
      else if (file.size > MAX_REPORT_FILE_BYTES) problems.push(f.tooBig(file.name));
      else
        next.push({
          name: file.name,
          mime: file.type,
          size: file.size,
          data: await readAsDataUrl(file),
        });
    }
    setErrors(problems);
    setAdded((old) => [...old, ...next]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problems: string[] = [];
    if (!title.trim()) problems.push(f.titleRequired);
    const used = rows.filter((row) => row.name.trim() || row.value.trim());
    used.forEach((row, i) => {
      const n = num(row.value);
      const bad = (s: string) => s.trim() !== "" && !Number.isFinite(Number(s));
      if (!row.name.trim() || n === null || !Number.isFinite(n) || bad(row.low) || bad(row.high))
        problems.push(f.valueInvalid(i + 1));
    });
    setErrors(problems);
    if (problems.length) return;

    setSaving(true);
    try {
      await onSubmit({
        title,
        type,
        date,
        doctor,
        notes,
        concernIds,
        addFiles: added,
        removeFileIds: files.filter((x) => !kept.includes(x.id)).map((x) => x.id),
        values: used.map((row) => ({
          id: row.id,
          name: row.name,
          value: Number(row.value),
          unit: row.unit,
          low: num(row.low),
          high: num(row.high),
          note: row.note,
        })),
      });
      onClose();
    } catch (err) {
      setErrors([copy.pages.health.failed(err instanceof Error ? err.message : String(err))]);
      setSaving(false);
    }
  };

  const fileChip = (key: string, name: string, size: number, onRemove: () => void) => (
    <li
      key={key}
      className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
    >
      <span className="flex min-w-0 items-center gap-2">
        <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(size)}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={f.removeFile(name)}
        onClick={onRemove}
      >
        <X aria-hidden />
      </Button>
    </li>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{report ? f.editTitle : f.addTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField label={f.title} htmlFor="report-title">
            <Input
              id="report-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={f.titlePlaceholder}
              autoComplete="off"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={f.type} htmlFor="report-type">
              <NativeSelect
                id="report-type"
                value={type}
                onChange={(e) => setType(e.target.value as ReportType)}
                className="w-full"
              >
                {TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {r.types[t]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={f.date} htmlFor="report-date">
              <Input
                id="report-date"
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </FormField>
            <FormField label={f.doctor} htmlFor="report-doctor">
              <Input
                id="report-doctor"
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                autoComplete="off"
              />
            </FormField>
          </div>

          <FormField label={f.files}>
            <p className="-mt-1 text-xs text-muted-foreground">{f.filesHint}</p>
            {(kept.length > 0 || added.length > 0) && (
              <ul className="grid gap-1.5" data-testid="report-files">
                {files
                  .filter((x) => kept.includes(x.id))
                  .map((x) =>
                    fileChip(x.id, x.name, x.size, () =>
                      setKept((k) => k.filter((id) => id !== x.id)),
                    ),
                  )}
                {added.map((x, i) =>
                  fileChip(`new-${i}`, x.name, x.size, () =>
                    setAdded((a) => a.filter((_, j) => j !== i)),
                  ),
                )}
              </ul>
            )}
            <div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="sr-only"
                aria-label={f.chooseFiles}
                onChange={chooseFiles}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
                <Paperclip aria-hidden />
                {f.chooseFiles}
              </Button>
            </div>
          </FormField>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">{f.values}</legend>
            <p className="text-xs text-muted-foreground">{f.valuesHint}</p>
            <datalist id="known-values">
              {series.map((s) => (
                <option key={s.name} value={s.name} />
              ))}
            </datalist>
            <ul className="grid gap-2" data-testid="value-rows">
              {rows.map((row, i) => (
                <li
                  key={i}
                  className="grid grid-cols-2 items-end gap-2 rounded-xl border p-2.5 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
                >
                  <FormField
                    label={f.valueName}
                    htmlFor={`v-name-${i}`}
                    className="col-span-2 sm:col-span-1"
                  >
                    <Input
                      id={`v-name-${i}`}
                      list="known-values"
                      value={row.name}
                      placeholder={f.valueNamePlaceholder}
                      onChange={(e) => setRow(i, { name: e.target.value })}
                      onBlur={() => fillFromHistory(i)}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label={f.value} htmlFor={`v-value-${i}`}>
                    <Input
                      id={`v-value-${i}`}
                      inputMode="decimal"
                      value={row.value}
                      onChange={(e) => setRow(i, { value: e.target.value })}
                    />
                  </FormField>
                  <FormField label={f.unit} htmlFor={`v-unit-${i}`}>
                    <Input
                      id={`v-unit-${i}`}
                      value={row.unit}
                      onChange={(e) => setRow(i, { unit: e.target.value })}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label={f.low} htmlFor={`v-low-${i}`}>
                    <Input
                      id={`v-low-${i}`}
                      inputMode="decimal"
                      value={row.low}
                      onChange={(e) => setRow(i, { low: e.target.value })}
                    />
                  </FormField>
                  <FormField label={f.high} htmlFor={`v-high-${i}`}>
                    <Input
                      id={`v-high-${i}`}
                      inputMode="decimal"
                      value={row.high}
                      onChange={(e) => setRow(i, { high: e.target.value })}
                    />
                  </FormField>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={f.removeValue(i + 1)}
                    onClick={() =>
                      setRows((old) =>
                        old.length > 1 ? old.filter((_, j) => j !== i) : [emptyRow()],
                      )
                    }
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRows((old) => [...old, emptyRow()])}
              >
                <Plus aria-hidden />
                {f.addValue}
              </Button>
            </div>
          </fieldset>

          {issues.length > 0 && (
            <FormField label={f.issues}>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {issues.map((i) => (
                  <li key={i.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={concernIds.includes(i.id)}
                        onChange={() =>
                          setConcernIds((old) =>
                            old.includes(i.id) ? old.filter((x) => x !== i.id) : [...old, i.id],
                          )
                        }
                      />
                      {i.title}
                    </label>
                  </li>
                ))}
              </ul>
            </FormField>
          )}

          <FormField label={f.notes} htmlFor="report-notes">
            <Textarea
              id="report-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={f.notesPlaceholder}
            />
          </FormField>

          {errors.length > 0 && (
            <ul role="alert" className="text-sm font-medium text-destructive">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {f.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {report ? f.save : f.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
