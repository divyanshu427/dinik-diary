import { z } from "zod";
import { copy } from "@/copy";
import type { HabitDraft } from "@/data/habit-ops";
import { habitType, partOfDay, type Habit, type HabitTarget } from "@/data/schema";

/*
 * The habit form keeps every input as text (that's what inputs hold), validates it here,
 * then converts it to a HabitDraft for the data layer.
 */

const e = copy.pages.habits.form.errors;

const scheduleKinds = ["daily", "weekdays", "timesPerWeek", "everyNDays"] as const;

export const habitFormSchema = z
  .object({
    name: z.string().trim().min(1, e.name),
    description: z.string(),
    phaseId: z.string().min(1),
    categoryId: z.string(), // "" = no category
    type: habitType,
    direction: z.enum(["higher_better", "lower_better"]),
    unit: z.string(),
    targetValue: z.string(),
    targetTime: z.string(),
    graceMinutes: z.string(),
    scheduleKind: z.enum(scheduleKinds),
    partOfDay,
    days: z.array(z.string()),
    times: z.string(),
    every: z.string(),
    anchor: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

    if (v.type === "count" || v.type === "duration" || v.type === "numeric") {
      if (!(num(v.targetValue) > 0)) issue("targetValue", e.target);
    }
    if (v.type === "time") {
      if (!/^\d\d:\d\d$/.test(v.targetTime)) issue("targetTime", e.time);
      const g = num(v.graceMinutes);
      if (!(Number.isInteger(g) && g >= 0)) issue("graceMinutes", e.grace);
    }
    if (v.scheduleKind === "weekdays" && v.days.length === 0) issue("days", e.days);
    if (v.scheduleKind === "timesPerWeek") {
      const t = num(v.times);
      if (!(Number.isInteger(t) && t >= 1 && t <= 7)) issue("times", e.times);
    }
    if (v.scheduleKind === "everyNDays") {
      const n = num(v.every);
      if (!(Number.isInteger(n) && n >= 2)) issue("every", e.every);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.anchor)) issue("anchor", e.date);
    }
  });

export type HabitFormValues = z.infer<typeof habitFormSchema>;

/** Form values for a new habit. */
export function emptyHabitForm(phaseId: string, today: string): HabitFormValues {
  return {
    name: "",
    description: "",
    phaseId,
    categoryId: "",
    type: "boolean",
    direction: "higher_better",
    unit: "",
    targetValue: "",
    targetTime: "07:30",
    graceMinutes: "15",
    scheduleKind: "daily",
    partOfDay: "anytime",
    days: [],
    times: "3",
    every: "7",
    anchor: today,
  };
}

/** Form values for editing an existing habit with its current target. */
export function habitToForm(
  habit: Habit,
  target: HabitTarget | undefined,
  today: string,
): HabitFormValues {
  const base = emptyHabitForm(habit.phaseId, today);
  const s = habit.schedule;
  return {
    ...base,
    name: habit.name,
    description: habit.description,
    categoryId: habit.categoryId ?? "",
    type: habit.type,
    direction: habit.direction,
    unit: habit.unit,
    targetValue: target?.targetValue != null ? String(target.targetValue) : "",
    targetTime: target?.targetTime ?? base.targetTime,
    graceMinutes: String(target?.graceMinutes ?? base.graceMinutes),
    scheduleKind: s.kind,
    partOfDay: habit.partOfDay,
    days: s.kind === "weekdays" ? s.days.map(String) : [],
    times: s.kind === "timesPerWeek" ? String(s.times) : base.times,
    every: s.kind === "everyNDays" ? String(s.every) : base.every,
    anchor: s.kind === "everyNDays" ? s.anchor : today,
  };
}

/** Converts validated form values into what the data layer saves. */
export function formToDraft(v: HabitFormValues): HabitDraft {
  const schedule: Habit["schedule"] =
    v.scheduleKind === "weekdays"
      ? { kind: "weekdays", days: v.days.map(Number).sort((a, b) => a - b) }
      : v.scheduleKind === "timesPerWeek"
        ? { kind: "timesPerWeek", times: Number(v.times) }
        : v.scheduleKind === "everyNDays"
          ? { kind: "everyNDays", every: Number(v.every), anchor: v.anchor }
          : { kind: "daily" };

  const isAmount = v.type === "count" || v.type === "duration" || v.type === "numeric";
  return {
    name: v.name,
    description: v.description,
    type: v.type,
    unit: v.type === "duration" ? "min" : isAmount ? v.unit : "",
    direction: isAmount ? v.direction : "higher_better",
    schedule,
    partOfDay: v.partOfDay,
    phaseId: v.phaseId,
    categoryId: v.categoryId || null,
    target: {
      targetValue: isAmount ? Number(v.targetValue) : null,
      targetTime: v.type === "time" ? v.targetTime : null,
      graceMinutes: v.type === "time" ? Number(v.graceMinutes) : 0,
    },
  };
}
