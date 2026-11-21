import type { IsoDate } from "@/lib/core";
import type { OpsContext } from "./habit-ops";
import type { HealthReport, LabValue, ReportType } from "./schema";

/*
 * Health reports (Build Phase 12.5): a report with its files (photos / PDFs) and the values
 * typed from it. Saving or deleting a report is one atomic step.
 */

/** Biggest file accepted (data stays in this browser and in backups). */
export const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;

export interface NewReportFile {
  name: string;
  mime: string;
  size: number;
  /** data: URL */
  data: string;
}

export interface LabValueDraft {
  /** Set when editing a value that's already saved. */
  id?: string;
  name: string;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
  note: string;
}

export interface ReportDraft {
  title: string;
  type: ReportType;
  date: IsoDate;
  doctor: string;
  notes: string;
  concernIds: string[];
  /** Files to add. */
  addFiles: NewReportFile[];
  /** Saved files to remove. */
  removeFileIds: string[];
  /** The report's values after saving (saved ones keep their id; missing ones are deleted). */
  values: LabValueDraft[];
}

const cleanValue = (v: LabValueDraft, date: IsoDate, reportId: string | null) => ({
  date,
  name: v.name.trim(),
  value: v.value,
  unit: v.unit.trim(),
  low: v.low,
  high: v.high,
  reportId,
  note: v.note.trim(),
});

/** Adds (id = null) or updates a report with its files and values. */
export function saveReport(
  ctx: OpsContext,
  id: string | null,
  draft: ReportDraft,
): Promise<HealthReport> {
  const { store } = ctx;
  return store.atomically(async () => {
    for (const f of draft.addFiles) {
      if (f.size > MAX_REPORT_FILE_BYTES) throw new RangeError(`“${f.name}” is larger than 10 MB.`);
    }
    const fields = {
      title: draft.title.trim(),
      type: draft.type,
      date: draft.date,
      doctor: draft.doctor.trim(),
      notes: draft.notes.trim(),
      concernIds: [...new Set(draft.concernIds)],
    };
    const report = id
      ? await store.healthReports.update(id, fields)
      : await store.healthReports.create(fields);

    for (const fileId of draft.removeFileIds) {
      const file = await store.reportFiles.get(fileId);
      if (file?.reportId === report.id) await store.reportFiles.remove(fileId);
    }
    for (const f of draft.addFiles) {
      await store.reportFiles.create({ reportId: report.id, ...f });
    }

    const existing = await store.labValues.listByReport(report.id);
    const keep = new Set(draft.values.flatMap((v) => (v.id ? [v.id] : [])));
    for (const v of existing) if (!keep.has(v.id)) await store.labValues.remove(v.id);
    for (const v of draft.values) {
      const row = cleanValue(v, report.date, report.id);
      if (!row.name) continue;
      if (v.id && existing.some((e) => e.id === v.id)) await store.labValues.update(v.id, row);
      else await store.labValues.create(row);
    }
    return report;
  });
}

/** Deletes a report with its files and values. */
export function deleteReport(ctx: OpsContext, id: string): Promise<void> {
  const { store } = ctx;
  return store.atomically(async () => {
    for (const f of await store.reportFiles.listByReport(id)) await store.reportFiles.remove(f.id);
    for (const v of await store.labValues.listByReport(id)) await store.labValues.remove(v.id);
    await store.healthReports.remove(id);
  });
}

/** A value measured without a report (e.g. blood pressure at home). id = null to add. */
export function saveLabValue(
  ctx: OpsContext,
  id: string | null,
  date: IsoDate,
  draft: LabValueDraft,
): Promise<LabValue> {
  const row = cleanValue(draft, date, null);
  if (!row.name) throw new Error("Give the value a name.");
  if (!id) return ctx.store.labValues.create(row);
  // Editing keeps the report it came from.
  const { reportId: _reportId, ...fields } = row;
  return ctx.store.labValues.update(id, fields);
}

export function deleteLabValue(ctx: OpsContext, id: string): Promise<void> {
  return ctx.store.labValues.remove(id);
}
