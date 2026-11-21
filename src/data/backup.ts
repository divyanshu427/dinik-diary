import { z } from "zod";
import {
  activitySchema,
  categorySchema,
  concernSchema,
  concernUpdateSchema,
  dayStatusSchema,
  habitLogSchema,
  habitSchema,
  habitTargetSchema,
  healthReportSchema,
  labValueSchema,
  metricSchema,
  phaseSchema,
  reportFileSchema,
  SCHEMA_VERSION,
  settingsSchema,
  timestamp,
} from "./schema";

/*
 * Backup file = every table as JSON. Used for:
 * - weekly backups (browser storage can be cleared),
 * - moving data between devices in Stage 1,
 * - importing into Supabase in Stage 2.
 */

export const BACKUP_APP_ID = "dinik-diary";
export const BACKUP_FORMAT = 1;

export const backupDataSchema = z.object({
  phases: z.array(phaseSchema),
  categories: z.array(categorySchema),
  habits: z.array(habitSchema),
  habitTargets: z.array(habitTargetSchema),
  habitLogs: z.array(habitLogSchema),
  dayStatus: z.array(dayStatusSchema),
  activities: z.array(activitySchema),
  metrics: z.array(metricSchema),
  concerns: z.array(concernSchema),
  concernUpdates: z.array(concernUpdateSchema),
  healthReports: z.array(healthReportSchema).default([]),
  reportFiles: z.array(reportFileSchema).default([]),
  labValues: z.array(labValueSchema).default([]),
  settings: settingsSchema,
});

export const backupFileSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().min(1).max(SCHEMA_VERSION),
  exportedAt: timestamp,
  data: backupDataSchema,
});

export type BackupFile = z.infer<typeof backupFileSchema>;
export type BackupData = BackupFile["data"];
export type ImportSummary = Record<keyof BackupData, number>;

export type ParseResult = { ok: true; file: BackupFile } | { ok: false; errors: string[] };

const MAX_ERRORS = 8;

/** Reads a backup file's text. Never throws: returns readable errors instead. */
export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["This file isn't valid JSON."] };
  }

  if (
    typeof json !== "object" ||
    json === null ||
    (json as { app?: unknown }).app !== BACKUP_APP_ID
  ) {
    return { ok: false, errors: ["This isn't a Dinik Diary backup file."] };
  }

  const parsed = backupFileSchema.safeParse(json);
  if (!parsed.success) {
    const errors = parsed.error.issues
      .slice(0, MAX_ERRORS)
      .map((i) => `${i.path.join(".") || "file"}: ${i.message}`);
    return { ok: false, errors };
  }

  const integrity = checkIntegrity(parsed.data.data);
  if (integrity.length) return { ok: false, errors: integrity.slice(0, MAX_ERRORS) };

  return { ok: true, file: parsed.data };
}

/** Checks that every reference points at a row that exists, and that ids/keys are unique. */
export function checkIntegrity(data: BackupData): string[] {
  const errors: string[] = [];
  const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));

  const unique = (table: string, values: string[]) => {
    const seen = new Set<string>();
    for (const v of values) {
      if (seen.has(v)) errors.push(`${table}: duplicate "${v}"`);
      seen.add(v);
    }
  };

  for (const [table, rows] of Object.entries(data)) {
    if (Array.isArray(rows) && rows.length && "id" in rows[0]) {
      unique(
        table,
        (rows as { id: string }[]).map((r) => r.id),
      );
    }
  }
  unique(
    "habits (key)",
    data.habits.map((h) => h.key),
  );
  unique(
    "habitLogs (habit + date)",
    data.habitLogs.map((l) => `${l.habitId}@${l.date}`),
  );
  unique(
    "metrics (date + key)",
    data.metrics.map((m) => `${m.date}@${m.key}`),
  );
  unique(
    "dayStatus (date)",
    data.dayStatus.map((d) => d.date),
  );

  const phaseIds = ids(data.phases);
  const categoryIds = ids(data.categories);
  const habitIds = ids(data.habits);
  const concernIds = ids(data.concerns);

  const ref = (
    table: string,
    rowId: string,
    field: string,
    value: string | null,
    valid: Set<string>,
  ) => {
    if (value !== null && !valid.has(value)) {
      errors.push(`${table} ${rowId}: ${field} points to a missing row (${value})`);
    }
  };

  data.categories.forEach((c) => ref("categories", c.id, "parentId", c.parentId, categoryIds));
  data.habits.forEach((h) => {
    ref("habits", h.id, "phaseId", h.phaseId, phaseIds);
    ref("habits", h.id, "categoryId", h.categoryId, categoryIds);
  });
  data.habitTargets.forEach((t) => ref("habitTargets", t.id, "habitId", t.habitId, habitIds));
  data.habitLogs.forEach((l) => ref("habitLogs", l.id, "habitId", l.habitId, habitIds));
  data.activities.forEach((a) => ref("activities", a.id, "categoryId", a.categoryId, categoryIds));
  data.concerns.forEach((c) =>
    c.linkedHabitIds.forEach((h) => ref("concerns", c.id, "linkedHabitIds", h, habitIds)),
  );
  data.concernUpdates.forEach((u) =>
    ref("concernUpdates", u.id, "concernId", u.concernId, concernIds),
  );
  const reportIds = ids(data.healthReports);
  data.healthReports.forEach((r) =>
    r.concernIds.forEach((c) => ref("healthReports", r.id, "concernIds", c, concernIds)),
  );
  data.reportFiles.forEach((f) => ref("reportFiles", f.id, "reportId", f.reportId, reportIds));
  data.labValues.forEach((v) => ref("labValues", v.id, "reportId", v.reportId, reportIds));

  return errors;
}

export function summarize(data: BackupData): ImportSummary {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 1]),
  ) as ImportSummary;
}

/** e.g. "dinik-diary-backup-2026-11-20.json" */
export function backupFileName(date: string): string {
  return `${BACKUP_APP_ID}-backup-${date}.json`;
}
