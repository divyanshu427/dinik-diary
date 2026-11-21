import type { Activity, Category } from "@/data/schema";
import { tokenVar } from "@/theme/tokens";

/** The colour to draw a category with: its custom colour, or its theme token. */
export const categoryColor = (c: Pick<Category, "colorToken" | "customColor"> | undefined) =>
  c?.customColor ?? tokenVar(c?.colorToken ?? "chart-other");

export interface CategoryTotal {
  categoryId: string;
  entries: number;
  minutes: number;
}

/** Entries and minutes per category, most minutes first (untimed entries count as entries only). */
export function totalsByCategory(activities: readonly Activity[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const a of activities) {
    const t = map.get(a.categoryId) ?? { categoryId: a.categoryId, entries: 0, minutes: 0 };
    t.entries += 1;
    t.minutes += a.durationMinutes ?? 0;
    map.set(a.categoryId, t);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes || b.entries - a.entries);
}

/** "2 h 30 min", "45 min", "1 h" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Order within a day: timed entries by start time, then untimed ones in the order they were added. */
export function byTimeOfDay(a: Activity, b: Activity): number {
  if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
  if (a.startTime) return -1;
  if (b.startTime) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

/** "#Solo, with friends" → ["solo", "with-friends"] */
export function parseTags(text: string): string[] {
  const tags = text
    .split(/[,#]+/)
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);
  return [...new Set(tags)];
}

/** "Riya, Sam ,," → ["Riya", "Sam"] */
export function parsePeople(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ];
}
