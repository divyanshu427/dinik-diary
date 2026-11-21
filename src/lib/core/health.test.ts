import { describe, expect, it } from "vitest";
import { addDays, eachDay } from "./day";
import {
  adviseHealth,
  adviseHealthAll,
  afterEffect,
  firstHelper,
  habitEffect,
  habitRoles,
  healthTrend,
  planChange,
  type AdvisorHabit,
  type HealthIssueInput,
  type HealthSuggestion,
} from "./health";
import { libraryRole, profileFor } from "./health-library";

const today = "2026-11-21";
const ago = (n: number) => addDays(today, -n);
const days28 = new Set(eachDay(ago(28), today));

const habit = (
  name: string,
  over: Partial<AdvisorHabit> = {},
  targetValue: number | null = null,
): AdvisorHabit => ({
  id: name.toLowerCase().replace(/\W+/g, "_"),
  name,
  key: name.toLowerCase().replace(/\W+/g, "_"),
  type: targetValue === null ? "boolean" : "duration",
  direction: "higher_better",
  target: { targetValue, targetTime: null, graceMinutes: 0 },
  doneDates: new Set(),
  dueDates: days28,
  ...over,
});

// The example from the conversation: steps 5,100, exercise 30 min, water 3 L.
const steps = habit("Daily steps", { type: "numeric" }, 5100);
const workout = habit("Workout or yoga", {}, 30);
const water = habit("Water goal", { type: "numeric" }, 3);
const stretching = habit("Stretching", {}, 10);
const screen = habit("Screen time limit", { type: "numeric", direction: "lower_better" }, 180);
const bath = habit("Bath");
const all = [steps, workout, water, stretching, screen, bath];
const all6 = all;

const issue = (
  title: string,
  levels: number[],
  over: Partial<HealthIssueInput> = {},
): HealthIssueInput => ({
  id: title.toLowerCase().replace(/\W+/g, "-"),
  title,
  kind: profileFor(title)?.kind ?? "symptom",
  status: "active",
  helpsWith: "",
  linkedHabitIds: [],
  strainHabitIds: [],
  adjustments: [],
  dismissed: [],
  // The last level is today's.
  checkIns: levels.map((severity, i) => ({ date: ago(levels.length - 1 - i), severity })),
  ...over,
});

const advise = (issues: HealthIssueInput[], habits = all, todayIsSick = false) =>
  adviseHealth({ issues, habits, today, todayIsSick });

const changes = (s: HealthSuggestion[]) =>
  s.flatMap((x) =>
    x.kind === "change"
      ? [[x.habitId, x.change.mode, x.change.mode === "pause" ? null : x.change.values.targetValue]]
      : [],
  );

describe("the app works out which habits matter, from what I say is wrong", () => {
  it("recognises common issues by name", () => {
    expect(profileFor("Lower back pain")?.id).toBe("back");
    expect(profileFor("migraine")?.id).toBe("headache");
    expect(profileFor("Acidity after dinner")?.id).toBe("stomach");
    expect(profileFor("Hair fall")?.kind).toBe("concern");
    expect(profileFor("Elbow ache")?.id).toBe("joints");
    expect(profileFor("Something odd")).toBeNull();
  });

  it("reads my own habits by name, and “No …” habits always count as helping", () => {
    const back = profileFor("back pain")!;
    expect(libraryRole(back, workout)).toBe("strain");
    expect(libraryRole(back, stretching)).toBe("helps");
    expect(libraryRole(back, bath)).toBeNull();
    expect(libraryRole(back, { name: "Weekly weight check", key: "weight_check" })).toBeNull();
    expect(libraryRole(back, { name: "Weight training", key: "weights" })).toBe("strain");
    // Whole words only: "sunscreen" isn't a screen.
    const headache = profileFor("headache")!;
    expect(
      libraryRole(headache, { name: "Moisturiser and sunscreen", key: "moisturiser_sunscreen" }),
    ).toBeNull();
    expect(libraryRole(headache, { name: "Screen time limit", key: "screen_time" })).toBe("strain");
    const stomach = profileFor("acidity")!;
    expect(libraryRole(stomach, { name: "No late-night junk food", key: "no_late_junk" })).toBe(
      "helps",
    );
  });

  it("back pain at 6 twice: exercise 30 → 15 min; steps and stretching stay", () => {
    const s = advise([issue("Back pain", [6, 7])]);
    expect(changes(s)).toEqual([["workout_or_yoga", "lower", 15]]);
    expect(s.find((x) => x.kind === "change")).toMatchObject({
      days: 5,
      reasons: [
        { source: "usual", profile: "back", role: "strain" },
        { source: "recent", done: 0, of: 3 },
      ],
    });
  });

  it("knee pain lightens steps too: 5,100 → 2,600", () => {
    expect(changes(advise([issue("Knee pain", [6, 6])]))).toEqual([
      ["daily_steps", "lower", 2600],
      ["workout_or_yoga", "lower", 15],
    ]);
  });

  it("a headache raises water (3 → 3.5 L) and tightens screen time (180 → 120 min)", () => {
    // One check-in is enough to raise what helps; two bad ones to cut back.
    expect(changes(advise([issue("Headache", [4])]))).toEqual([["water_goal", "raise", 3.5]]);
    expect(changes(advise([issue("Headache", [6, 6])]))).toEqual([
      ["water_goal", "raise", 3.5],
      ["screen_time_limit", "tighten", 120],
    ]);
  });

  it("a cold or fever acts from 5 and pauses yes/no exercise", () => {
    const gym = habit("Gym session");
    expect(changes(advise([issue("Cold", [5, 5])], [gym]))).toEqual([
      ["gym_session", "pause", null],
    ]);
  });

  it("concerns like hair fall never cut the routine, but get something helpful added", () => {
    const s = advise([issue("Hair fall", [6, 6])], [workout, bath]);
    expect(changes(s)).toEqual([]);
    expect(s).toEqual([expect.objectContaining({ kind: "add-helper", profile: "hair" })]);
  });

  it("suggests a helpful habit only when nothing helpful is on the checklist", () => {
    expect(advise([issue("Back pain", [4])], [bath]).map((x) => x.kind)).toEqual(["add-helper"]);
    expect(advise([issue("Back pain", [4])], [bath, stretching])).toEqual([]);
  });

  it("an issue the app doesn't know is still tracked and still says when to see a doctor", () => {
    const odd = issue("Something odd", [9], { kind: "symptom" });
    expect(advise([odd]).map((x) => x.kind)).toEqual(["see-doctor", "sick-day"]);
  });
});

describe("my history counts", () => {
  it("finds a habit that makes it worse the next day, even one the library doesn't know", () => {
    // Pain is 7 on the days after Climbing, around 4 otherwise.
    const climbing = habit("Climbing", { doneDates: new Set([ago(6), ago(5), ago(2)]) }, 60);
    const back = issue("Back pain", [4, 7, 7, 3, 4, 7, 6]);
    expect(habitRoles(back, [climbing]).get("climbing")).toEqual({
      role: "strain",
      reasons: [{ source: "after", withHabit: 7, without: 4.3 }],
    });
    expect(changes(advise([back], [climbing]))).toEqual([["climbing", "lower", 30]]);
  });

  it("finds a habit that helps (lower on the days I did it)", () => {
    const walk = habit("Evening walk", { doneDates: new Set([ago(5), ago(4), ago(1)]) }, 20);
    const roles = habitRoles(issue("Back pain", [7, 3, 3, 7, 7, 3, 6]), [walk]);
    expect(roles.get("evening_walk")).toEqual({
      role: "helps",
      reasons: [{ source: "lower", withHabit: 3, without: 6.8 }],
    });
  });

  it("when the data could mean either, it falls back to what usually holds", () => {
    // Every other day: lower on the day, higher the day after. Unclear, so the library decides.
    const gym = habit("Gym", { doneDates: new Set([ago(6), ago(4), ago(2)]) }, 45);
    const roles = habitRoles(issue("Back pain", [3, 7, 3, 7, 3, 7, 6]), [gym]);
    expect(roles.get("gym")).toEqual({
      role: "strain",
      reasons: [{ source: "usual", profile: "back", role: "strain" }],
    });
  });

  it("my own word beats the library", () => {
    const back = issue("Back pain", [6, 6], {
      linkedHabitIds: ["workout_or_yoga"],
      strainHabitIds: ["daily_steps"],
    });
    expect(changes(advise([back]))).toEqual([["daily_steps", "lower", 2600]]);
  });
});

describe("safety and timing", () => {
  it("“in a row” means close together: 9 a week ago and 8 yesterday isn't a pattern", () => {
    const back = issue("Back pain", [], {
      checkIns: [
        { date: ago(8), severity: 9 },
        { date: ago(1), severity: 8 },
      ],
    });
    // Still 8/10: a doctor first. But no routine changes from two check-ins a week apart.
    expect(advise([back]).map((x) => x.kind)).toEqual(["see-doctor"]);
    const close = issue("Back pain", [], {
      checkIns: [
        { date: ago(3), severity: 7 },
        { date: ago(1), severity: 7 },
      ],
    });
    expect(changes(advise([close]))).toEqual([["workout_or_yoga", "lower", 15]]);
  });

  it("answered suggestions are kept aside, not lost", () => {
    const back = issue("Back pain", [6, 8], {
      dismissed: [`see-doctor:back-pain:${today}`],
    });
    const all = adviseHealthAll({ issues: [back], habits: all6, today, todayIsSick: false });
    expect(all.hidden.map((x) => x.kind)).toEqual(["see-doctor"]);
    expect(all.shown.map((x) => x.kind)).toEqual(["change", "sick-day"]);
  });

  it("8+ or worse three times in a row: doctor first, and no new exercise", () => {
    const high = advise([issue("Back pain", [7, 8])], [workout, bath]);
    expect(high.map((x) => x.kind)).toEqual(["see-doctor", "change", "sick-day"]);
    expect(advise([issue("Back pain", [3, 4, 5])], [bath]).map((x) => x.kind)).toEqual([
      "see-doctor",
    ]);
  });

  it("old check-ins, resolved issues and dismissed ideas stay quiet; one change per habit", () => {
    const old = issue("Back pain", [8, 8]);
    old.checkIns = old.checkIns.map((c) => ({ ...c, date: addDays(c.date, -5) }));
    expect(advise([old])).toEqual([]);
    expect(advise([issue("Back pain", [8, 8], { status: "resolved" })])).toEqual([]);
    const dismissed = issue("Back pain", [6, 6], {
      dismissed: [`change:back-pain:workout_or_yoga:${today}`],
    });
    expect(changes(advise([dismissed]))).toEqual([]);
    const two = advise([issue("Back pain", [6, 6]), issue("Knee pain", [6, 6])]);
    expect(changes(two).filter(([id]) => id === "workout_or_yoga")).toHaveLength(1);
    expect(advise([issue("Back pain", [7, 7])], [bath, stretching], true)).toEqual([]);
  });

  it("feeling better twice ends running changes early", () => {
    const running = {
      id: "a1",
      kind: "ease" as const,
      habitId: "workout_or_yoga",
      from: ago(2),
      to: addDays(today, 2),
      previous: null,
      eased: null,
      endedOn: null,
    };
    expect(
      advise([issue("Back pain", [2, 3], { adjustments: [running] })]).map((x) => x.kind),
    ).toEqual(["back-to-normal"]);
  });
});

describe("numbers", () => {
  it("rounds changes to natural steps", () => {
    expect(planChange(steps, "strain")).toEqual({
      mode: "lower",
      values: expect.objectContaining({ targetValue: 2600 }),
    });
    expect(planChange(habit("Walk", {}, 10), "strain")).toMatchObject({
      values: { targetValue: 5 },
    });
    expect(planChange(habit("Sleep", { type: "numeric" }, 7), "raise")).toMatchObject({
      values: { targetValue: 8 },
    });
    expect(planChange(bath, "raise")).toBeNull();
    expect(planChange(bath, "strain")).toEqual({ mode: "pause" });
  });

  it("compares this week with last week", () => {
    const points = [8, 7, 7, 6, 6, 6, 6, 5, 4, 4, 3, 4, 4, 4].map((severity, i) => ({
      date: ago(13 - i),
      severity,
    }));
    expect(healthTrend(points, today)).toEqual({ recent: 4, before: 6.6 });
  });

  it("needs 3+ days each way and a clear gap for a pattern", () => {
    const points = [2, 6, 2, 7, 3, 6].map((severity, i) => ({ date: ago(5 - i), severity }));
    expect(habitEffect(points, new Set([ago(5), ago(3), ago(1)]))).toEqual({
      withHabit: 2.3,
      without: 6.3,
    });
    expect(habitEffect(points, new Set([ago(5)]))).toBeNull();
    expect(afterEffect(points, new Set([ago(5)]))).toBeNull();
  });

  it("reads the first thing that helps", () => {
    expect(firstHelper("stretching and a warm shower")).toBe("Stretching");
    expect(firstHelper("  ")).toBeNull();
  });
});
