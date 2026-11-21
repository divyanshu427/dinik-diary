import type { IsoDate } from "./day";

/*
 * Values from health reports (Build Phase 12.5), e.g. Vitamin D 18 ng/mL (normal 30–100).
 * The normal range is whatever the report says: labs differ, so nothing here is fixed.
 */

export type LabStatus = "low" | "high" | "normal";

/** Below, above or inside the normal range; null when the report gives no range. */
export function labStatus(
  value: number,
  low: number | null,
  high: number | null,
): LabStatus | null {
  if (low === null && high === null) return null;
  if (low !== null && value < low) return "low";
  if (high !== null && value > high) return "high";
  return "normal";
}

export interface LabPoint {
  id: string;
  date: IsoDate;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
  reportId: string | null;
}

export interface LabSeries {
  /** As first written, e.g. "Vitamin D". */
  name: string;
  unit: string;
  /** Oldest first. */
  points: LabPoint[];
  latest: LabPoint;
  status: LabStatus | null;
  /** Latest value against the one before, when there is one. */
  change: number | null;
}

/** "vitamin d " and "Vitamin D" are the same value. */
export const labKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** Values grouped by name, each with its history; the most recent first. */
export function labSeries(values: readonly (LabPoint & { name: string })[]): LabSeries[] {
  const groups = new Map<string, (LabPoint & { name: string })[]>();
  for (const v of values) groups.set(labKey(v.name), [...(groups.get(labKey(v.name)) ?? []), v]);
  return [...groups.values()]
    .map((list) => {
      const points = [...list].sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      );
      const latest = points.at(-1)!;
      const before = points.at(-2);
      return {
        name: points[0].name.trim(),
        unit: latest.unit,
        points,
        latest,
        status: labStatus(latest.value, latest.low, latest.high),
        change: before ? Math.round((latest.value - before.value) * 100) / 100 : null,
      };
    })
    .sort((a, b) => b.latest.date.localeCompare(a.latest.date) || a.name.localeCompare(b.name));
}
