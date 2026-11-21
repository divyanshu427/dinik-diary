import { blockOf, minutesIntoDay, minuteToTime, overlapRemainder, type IsoDate } from "@/lib/core";
import type { DataStore } from "./repositories";
import type { Activity, Category, ColorToken, NewRow } from "./schema";

/*
 * Activities and categories (Build Phase 7): the variable things of a day ("Visited the fort",
 * "Interview, 30 min"), each its own entry under a category.
 */

/** What the activity form produces. */
export type ActivityDraft = Omit<
  NewRow<Activity>,
  "source" | "rawMessageId" | "aiConfidence" | "confirmed"
>;

/**
 * Minutes between two "HH:mm" times. An end earlier than the start means it ran past midnight
 * (22:30 → 01:00 = 150 min). Compared within the logical day, so the 4 AM rule holds.
 */
export function minutesBetween(start: string, end: string, dayStartHour: number): number {
  const s = minutesIntoDay(start, dayStartHour);
  const e = minutesIntoDay(end, dayStartHour);
  return e > s ? e - s : e + 1440 - s;
}

/** Fills in the duration from start and end times when both are given. */
export function withDuration(draft: ActivityDraft, dayStartHour: number): ActivityDraft {
  if (draft.startTime && draft.endTime) {
    return {
      ...draft,
      durationMinutes: minutesBetween(draft.startTime, draft.endTime, dayStartHour),
    };
  }
  return draft;
}

const manual = { source: "web", rawMessageId: null, aiConfidence: null, confirmed: true } as const;

export interface ActivityContext {
  store: DataStore;
  dayStartHour: number;
}

export function createActivity(ctx: ActivityContext, draft: ActivityDraft): Promise<Activity> {
  return ctx.store.activities.create({ ...withDuration(draft, ctx.dayStartHour), ...manual });
}

export function updateActivity(
  ctx: ActivityContext,
  id: string,
  draft: ActivityDraft,
): Promise<Activity> {
  return ctx.store.activities.update(id, withDuration(draft, ctx.dayStartHour));
}

export function deleteActivity(ctx: ActivityContext, id: string): Promise<void> {
  return ctx.store.activities.remove(id);
}

/** Copies an entry to another day (e.g. "the same as yesterday"). */
export async function duplicateActivity(
  ctx: ActivityContext,
  id: string,
  date: IsoDate,
): Promise<Activity> {
  const source = await ctx.store.activities.get(id);
  if (!source) throw new Error("Activity not found");
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
  return ctx.store.activities.create({ ...rest, date, ...manual });
}

/** Copies every entry from one day to another, in one step. Returns how many were copied. */
export function repeatDay(ctx: ActivityContext, from: IsoDate, to: IsoDate): Promise<number> {
  const { store } = ctx;
  return store.atomically(async () => {
    const entries = await store.activities.listRange(from, from);
    for (const entry of entries) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = entry;
      await store.activities.create({ ...rest, date: to, ...manual });
    }
    return entries.length;
  });
}

// ---------- overlaps ----------

type Timed = Pick<Activity, "startTime" | "endTime" | "durationMinutes">;

/** What fixing an overlap does to the longer entry (the shorter one keeps the shared time). */
export type OverlapFix =
  | { kind: "remove" }
  | { kind: "trim"; startTime: string; endTime: string }
  | {
      kind: "split";
      parts: [{ startTime: string; endTime: string }, { startTime: string; endTime: string }];
    };

/** Works out the fix without saving anything (used for the confirm message too). */
export function planOverlapFix(
  loser: Timed,
  winner: Timed,
  dayStartHour: number,
): OverlapFix | null {
  const l = blockOf(loser, dayStartHour);
  const w = blockOf(winner, dayStartHour);
  if (!l || !w) return null;
  const parts = overlapRemainder(l, w).map((p) => ({
    startTime: minuteToTime(p.start, dayStartHour),
    endTime: minuteToTime(p.end, dayStartHour),
  }));
  if (parts.length === 0) return { kind: "remove" };
  if (parts.length === 1) return { kind: "trim", ...parts[0] };
  return { kind: "split", parts: [parts[0], parts[1]] };
}

/**
 * Fixes an overlap: the longer entry (`loserId`) gives the shared time to the shorter one.
 * Trims it, splits it in two around the shorter one, or removes it when both cover the same time.
 */
export function fixOverlap(ctx: ActivityContext, loserId: string, winnerId: string): Promise<void> {
  const { store, dayStartHour } = ctx;
  return store.atomically(async () => {
    const loser = await store.activities.get(loserId);
    const winner = await store.activities.get(winnerId);
    if (!loser || !winner) throw new Error("Activity not found");
    const fix = planOverlapFix(loser, winner, dayStartHour);
    if (!fix) return;
    const timed = (t: { startTime: string; endTime: string }) => ({
      ...t,
      durationMinutes: minutesBetween(t.startTime, t.endTime, dayStartHour),
    });
    if (fix.kind === "remove") {
      await store.activities.remove(loserId);
    } else if (fix.kind === "trim") {
      await store.activities.update(loserId, timed(fix));
    } else {
      await store.activities.update(loserId, timed(fix.parts[0]));
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = loser;
      await store.activities.create({ ...rest, ...timed(fix.parts[1]) });
    }
  });
}

// ---------- categories ----------

export interface CategoryDraft {
  name: string;
  colorToken: ColorToken;
  customColor: string | null;
}

export function createCategory(ctx: ActivityContext, draft: CategoryDraft): Promise<Category> {
  const { store } = ctx;
  return store.atomically(async () => {
    const all = await store.categories.list();
    return store.categories.create({
      name: draft.name.trim(),
      colorToken: draft.colorToken,
      customColor: draft.customColor,
      parentId: null,
      icon: "circle",
      archived: false,
      sortOrder: all.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1,
    });
  });
}

export function updateCategory(
  ctx: ActivityContext,
  id: string,
  draft: CategoryDraft,
): Promise<Category> {
  return ctx.store.categories.update(id, {
    name: draft.name.trim(),
    colorToken: draft.colorToken,
    customColor: draft.customColor,
  });
}

export function setCategoryArchived(
  ctx: ActivityContext,
  id: string,
  archived: boolean,
): Promise<Category> {
  return ctx.store.categories.update(id, { archived });
}

/** Deletes a category nothing uses. Throws InUseError otherwise (merge or archive it instead). */
export function deleteCategory(ctx: ActivityContext, id: string): Promise<void> {
  return ctx.store.categories.remove(id);
}

/**
 * Merges `fromId` into `intoId`: its activities, habits and sub-categories move over, then it's
 * deleted. All in one step.
 */
export function mergeCategories(
  ctx: ActivityContext,
  fromId: string,
  intoId: string,
): Promise<void> {
  const { store } = ctx;
  if (fromId === intoId) return Promise.resolve();
  return store.atomically(async () => {
    const into = await store.categories.get(intoId);
    if (!into) throw new Error("Category to merge into not found");
    for (const a of await store.activities.list()) {
      if (a.categoryId === fromId) await store.activities.update(a.id, { categoryId: intoId });
    }
    for (const h of await store.habits.list()) {
      if (h.categoryId === fromId) await store.habits.update(h.id, { categoryId: intoId });
    }
    for (const c of await store.categories.list()) {
      if (c.parentId === fromId) await store.categories.update(c.id, { parentId: intoId });
    }
    await store.categories.remove(fromId);
  });
}
