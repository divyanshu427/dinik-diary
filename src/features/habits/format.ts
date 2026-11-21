import { copy } from "@/copy";
import type { Habit, HabitTarget, Phase } from "@/data/schema";

const s = copy.pages.habits;
const numberFormat = new Intl.NumberFormat("en-IN");

/** Unit shown next to a number: duration habits always use minutes. */
export function unitFor(habit: Pick<Habit, "type" | "unit">) {
  return habit.type === "duration" ? s.form.minutes : habit.unit;
}

/** "5,000 steps", "At most 30 min", "By 07:30, 15 min grace", "Yes / no". */
export function describeTarget(
  habit: Pick<Habit, "type" | "unit" | "direction">,
  target: Pick<HabitTarget, "targetValue" | "targetTime" | "graceMinutes"> | undefined,
): string {
  if (habit.type === "boolean") return s.summary.boolean;
  if (habit.type === "time") {
    return target?.targetTime
      ? s.summary.byTime(target.targetTime, target.graceMinutes)
      : s.summary.noTarget;
  }
  if (target?.targetValue == null) return s.summary.noTarget;
  const value = numberFormat.format(target.targetValue);
  return habit.direction === "lower_better"
    ? s.summary.atMost(value, unitFor(habit))
    : s.summary.atLeast(value, unitFor(habit));
}

/** "Every day", "Mon, Thu", "3× a week", "Every 10 days". */
export function describeSchedule(schedule: Habit["schedule"]): string {
  switch (schedule.kind) {
    case "daily":
      return s.scheduleSummary.daily;
    case "weekdays":
      return [...schedule.days]
        .sort((a, b) => a - b)
        .map((d) => s.weekdaysShort[d])
        .join(", ");
    case "timesPerWeek":
      return s.scheduleSummary.timesPerWeek(schedule.times);
    case "everyNDays":
      return s.scheduleSummary.everyNDays(schedule.every);
  }
}

/** "Phase 2 · Fitness and grooming" */
export const phaseLabel = (p: Pick<Phase, "number" | "name">) =>
  copy.pages.data.phaseLabel(p.number, p.name);

/** Short right-hand text for a habit in a start list: "30 min", "3× a week", "Every day". */
export function startListDetail(
  habit: Pick<Habit, "type" | "unit" | "direction" | "schedule">,
  target: Pick<HabitTarget, "targetValue" | "targetTime" | "graceMinutes"> | undefined,
): string {
  if (habit.type !== "boolean") return describeTarget(habit, target);
  return describeSchedule(habit.schedule);
}
