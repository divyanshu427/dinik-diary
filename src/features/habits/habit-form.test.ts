import { describe, expect, it } from "vitest";
import type { Habit, HabitTarget } from "@/data/schema";
import { describeSchedule, describeTarget } from "./format";
import { emptyHabitForm, formToDraft, habitFormSchema, habitToForm } from "./habit-form";

const TODAY = "2026-11-20";

const errorsFor = (values: object) => {
  const r = habitFormSchema.safeParse({ ...emptyHabitForm("p1", TODAY), ...values });
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
};

describe("habit form validation", () => {
  it("needs a name", () => {
    expect(errorsFor({ name: "  " })).toHaveProperty("name");
  });

  it("needs a target above 0 for counts, minutes and numbers", () => {
    expect(errorsFor({ name: "Water", type: "count", targetValue: "" })).toHaveProperty(
      "targetValue",
    );
    expect(errorsFor({ name: "Water", type: "count", targetValue: "0" })).toHaveProperty(
      "targetValue",
    );
    expect(errorsFor({ name: "Water", type: "count", targetValue: "8" })).toEqual({});
  });

  it("needs at least one day for a weekday schedule", () => {
    expect(errorsFor({ name: "Gym", scheduleKind: "weekdays", days: [] })).toHaveProperty("days");
  });

  it("limits times a week to 1–7", () => {
    expect(errorsFor({ name: "Hair", scheduleKind: "timesPerWeek", times: "9" })).toHaveProperty(
      "times",
    );
  });
});

describe("form ↔ habit conversion", () => {
  it("builds a draft with only the fields the type needs", () => {
    const draft = formToDraft({
      ...emptyHabitForm("p1", TODAY),
      name: "Yoga",
      type: "duration",
      unit: "ignored",
      targetValue: "30",
      targetTime: "07:30",
      scheduleKind: "weekdays",
      days: ["4", "0", "2"],
    });
    expect(draft).toMatchObject({
      type: "duration",
      unit: "min",
      schedule: { kind: "weekdays", days: [0, 2, 4] },
      target: { targetValue: 30, targetTime: null, graceMinutes: 0 },
    });
  });

  it("round-trips an existing habit", () => {
    const habit = {
      id: "h",
      key: "wake_up",
      name: "Wake up on time",
      description: "",
      type: "time",
      unit: "",
      direction: "higher_better",
      schedule: { kind: "everyNDays", every: 10, anchor: "2026-11-01" },
      phaseId: "p1",
      categoryId: "c1",
      metricKey: "wake_time",
      partOfDay: "morning",
      pauses: [],
      archived: false,
      sortOrder: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies Habit;
    const target = { targetValue: null, targetTime: "07:30", graceMinutes: 15 } as HabitTarget;
    const draft = formToDraft(habitToForm(habit, target, TODAY));
    expect(draft).toMatchObject({
      name: "Wake up on time",
      type: "time",
      categoryId: "c1",
      schedule: habit.schedule,
      target: { targetValue: null, targetTime: "07:30", graceMinutes: 15 },
    });
  });
});

describe("habit summaries", () => {
  it("describes targets in plain words", () => {
    const t = (v: number | null, time: string | null = null, grace = 0) => ({
      targetValue: v,
      targetTime: time,
      graceMinutes: grace,
    });
    expect(
      describeTarget({ type: "numeric", unit: "steps", direction: "higher_better" }, t(5000)),
    ).toBe("5,000 steps");
    expect(describeTarget({ type: "numeric", unit: "min", direction: "lower_better" }, t(30))).toBe(
      "At most 30 min",
    );
    expect(describeTarget({ type: "duration", unit: "", direction: "higher_better" }, t(30))).toBe(
      "30 min",
    );
    expect(
      describeTarget({ type: "time", unit: "", direction: "higher_better" }, t(null, "07:30", 15)),
    ).toBe("By 07:30, 15 min grace");
    expect(
      describeTarget({ type: "boolean", unit: "", direction: "higher_better" }, undefined),
    ).toBe("Yes / no");
  });

  it("describes schedules in plain words", () => {
    expect(describeSchedule({ kind: "daily" })).toBe("Every day");
    expect(describeSchedule({ kind: "weekdays", days: [3, 0] })).toBe("Mon, Thu");
    expect(describeSchedule({ kind: "timesPerWeek", times: 3 })).toBe("3× a week");
    expect(describeSchedule({ kind: "everyNDays", every: 10, anchor: "2026-11-01" })).toBe(
      "Every 10 days",
    );
  });
});
