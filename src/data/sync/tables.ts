import type { ZodType } from "zod";
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
  settingsSchema,
} from "../schema";

/*
 * How each table syncs. The order is the push order: parents before the rows that point to
 * them, so another device never receives a check-in before its habit.
 */

export type Row = Record<string, unknown> & { updatedAt: string };

export interface SyncTable {
  name: string;
  schema: ZodType;
  /** The primary key field ("id", or "date" for day types). */
  key: string;
  /**
   * Fields that must be unique on a device. Two devices can each create "the log for this
   * habit on this day" while offline; both then settle on the same one (the newer).
   */
  unique?: readonly string[];
  /** The row this one belongs to. When that row is deleted, this one goes too. */
  parent?: { table: string; field: string };
}

export const SYNC_TABLES: readonly SyncTable[] = [
  { name: "phases", schema: phaseSchema, key: "id" },
  { name: "categories", schema: categorySchema, key: "id" },
  { name: "habits", schema: habitSchema, key: "id", unique: ["key"] },
  {
    name: "habitTargets",
    schema: habitTargetSchema,
    key: "id",
    parent: { table: "habits", field: "habitId" },
  },
  {
    name: "habitLogs",
    schema: habitLogSchema,
    key: "id",
    unique: ["habitId", "date"],
    parent: { table: "habits", field: "habitId" },
  },
  { name: "dayStatus", schema: dayStatusSchema, key: "date" },
  { name: "activities", schema: activitySchema, key: "id" },
  { name: "metrics", schema: metricSchema, key: "id", unique: ["date", "key"] },
  { name: "concerns", schema: concernSchema, key: "id" },
  {
    name: "concernUpdates",
    schema: concernUpdateSchema,
    key: "id",
    parent: { table: "concerns", field: "concernId" },
  },
  { name: "healthReports", schema: healthReportSchema, key: "id" },
  {
    name: "reportFiles",
    schema: reportFileSchema,
    key: "id",
    parent: { table: "healthReports", field: "reportId" },
  },
  {
    name: "labValues",
    schema: labValueSchema,
    key: "id",
    parent: { table: "healthReports", field: "reportId" },
  },
  { name: "settings", schema: settingsSchema, key: "id" },
];

export const SYNC_TABLE_BY_NAME = new Map(SYNC_TABLES.map((t) => [t.name, t]));

/** Tables whose rows point to `parent`. */
export function childrenOf(parent: string) {
  return SYNC_TABLES.filter((t) => t.parent?.table === parent);
}

/** Tables that hold things I've done (not just the starter setup). */
export const OWN_DATA_TABLES = [
  "habitLogs",
  "dayStatus",
  "activities",
  "metrics",
  "concerns",
  "concernUpdates",
  "healthReports",
  "labValues",
] as const;

/** Report files keep their contents in file storage, not in the record. */
export const FILE_TABLE = "reportFiles";
