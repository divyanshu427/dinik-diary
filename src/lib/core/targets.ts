import type { HabitTarget } from "@/data/schema";
import { addDays, type IsoDate } from "./day";

/*
 * Target history (plan.md §5.4). When a target changes (e.g. 5,000 → 8,000 steps), the old
 * row is closed and a new one starts, so every past day is scored against the target it had.
 */

type TargetRange = Pick<HabitTarget, "validFrom" | "validTo">;

/**
 * The target that applied on `date`. If several overlap, the latest start wins.
 * For a date before the first target, the earliest target is used.
 */
export function targetOn<T extends TargetRange>(
  targets: readonly T[],
  date: IsoDate,
): T | undefined {
  const valid = targets.filter(
    (t) => t.validFrom <= date && (t.validTo === null || t.validTo >= date),
  );
  if (valid.length) return valid.reduce((a, b) => (b.validFrom > a.validFrom ? b : a));
  return [...targets].sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
}

export type TargetValues = Pick<HabitTarget, "targetValue" | "targetTime" | "graceMinutes">;

export type TargetChange =
  /** The open target started on/after `fromDate`: just change its values. */
  | { kind: "update"; id: string; values: TargetValues }
  /** Close the open target the day before `fromDate` and start a new one. */
  | {
      kind: "split";
      close: { id: string; validTo: IsoDate };
      create: TargetValues & { habitId: string; validFrom: IsoDate; validTo: null };
    }
  /** No target yet: create the first one. */
  | {
      kind: "create";
      create: TargetValues & { habitId: string; validFrom: IsoDate; validTo: null };
    };

/** Works out how to change a habit's target from `fromDate` on, keeping history. */
export function planTargetChange(
  habitId: string,
  targets: readonly HabitTarget[],
  values: TargetValues,
  fromDate: IsoDate,
): TargetChange {
  const open = targets.find((t) => t.validTo === null);
  if (!open) {
    return { kind: "create", create: { habitId, ...values, validFrom: fromDate, validTo: null } };
  }
  if (open.validFrom >= fromDate) {
    return { kind: "update", id: open.id, values };
  }
  return {
    kind: "split",
    close: { id: open.id, validTo: addDays(fromDate, -1) },
    create: { habitId, ...values, validFrom: fromDate, validTo: null },
  };
}
