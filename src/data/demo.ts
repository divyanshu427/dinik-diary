import {
  addDays,
  scoreEntry,
  sleepMinutes,
  targetOn,
  weekdayIndex,
  type IsoDate,
} from "@/lib/core";
import { BACKUP_APP_ID, BACKUP_FORMAT, backupFileSchema, type BackupFile } from "./backup";
import type { Activity, DayStatus, Habit, HabitLog, Metric, MetricKey } from "./schema";
import { SCHEMA_VERSION } from "./schema";
import { buildSeed, CATEGORY_SEEDS, type SeedOptions } from "./seed/defaults";

/*
 * Demo data (Build Phase 9): 60 days of a realistic, made-up life, for trying the reports
 * without real data. It lives in its own "demo" profile (a separate browser database), so
 * your own data is never touched.
 *
 * Same inputs → same data (a seeded random generator). Patterns are built in on purpose so
 * the insights have something real to find:
 * - steps are much higher at weekends;
 * - skipping breakfast usually means skipping the night face wash too;
 * - nights after 11:30 PM are followed by weaker days;
 * - reels minutes creep up over the two months;
 * - flossing (Phase 2) is often missed Tuesday to Thursday.
 */

export const DEMO_DAYS = 60;
/** Phase 2 was switched on this many days before today. */
export const DEMO_PHASE2_DAYS = 28;

/** Small, fast, seeded random numbers (mulberry32). */
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hhmm = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Noon in India on that date, so the logical date is the same in the default time zone. */
const stampOf = (date: IsoDate, minute = 0) =>
  new Date(Date.parse(`${date}T06:30:00.000Z`) + minute * 60_000).toISOString();

export interface DemoOptions {
  /** The last day of demo data (today). */
  today: IsoDate;
  theme?: SeedOptions["theme"];
  seed?: number;
}

export function buildDemoData({ today, theme, seed = 20261120 }: DemoOptions): BackupFile {
  const rand = seededRandom(seed);
  const between = (min: number, max: number) => min + rand() * (max - min);
  const chance = (p: number) => rand() < p;
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  let n = 0;
  const newId = () => `demo-${++n}`;
  const start = addDays(today, -(DEMO_DAYS - 1));
  const phase2Start = addDays(today, -(DEMO_PHASE2_DAYS - 1));
  const base = buildSeed({ now: stampOf(start), newId, theme });

  // Phase 1 from the start; Phase 2 enabled four weeks ago (Phase 1 then counts as completed).
  // Phase 2 raises daily steps to 8,000 from the day it started, like enabling it in the app.
  const phase1 = base.phases.find((p) => p.number === 1)!;
  const phase2 = base.phases.find((p) => p.number === 2)!;
  const stepsHabit = base.habits.find((h) => h.key === "steps")!;
  const stepsBefore = base.habitTargets.find((t) => t.habitId === stepsHabit.id)!;
  const stepsUpgrade = phase2.targetUpgrades.find((u) => u.habitId === stepsHabit.id);
  const values = (t: {
    targetValue: number | null;
    targetTime: string | null;
    graceMinutes: number;
  }) => ({
    targetValue: t.targetValue,
    targetTime: t.targetTime,
    graceMinutes: t.graceMinutes,
  });

  const phases = base.phases.map((p) =>
    p.id === phase1.id
      ? {
          ...p,
          status: "completed" as const,
          startedAt: stampOf(start),
          endedAt: stampOf(phase2Start),
          history: [
            { date: start, kind: "started" as const },
            { date: phase2Start, kind: "completed" as const },
          ],
        }
      : p.id === phase2.id
        ? {
            ...p,
            status: "active" as const,
            startedAt: stampOf(phase2Start),
            updatedAt: stampOf(phase2Start),
            history: [
              {
                date: phase2Start,
                kind: "started" as const,
                ...(stepsUpgrade
                  ? {
                      changes: [
                        {
                          habitId: stepsHabit.id,
                          from: values(stepsBefore),
                          to: values(stepsUpgrade),
                        },
                      ],
                    }
                  : {}),
              },
            ],
          }
        : p,
  );
  const habitTargets = stepsUpgrade
    ? [
        ...base.habitTargets.map((t) =>
          t.id === stepsBefore.id ? { ...t, validTo: addDays(phase2Start, -1) } : t,
        ),
        {
          ...stepsBefore,
          id: newId(),
          ...values(stepsUpgrade),
          validFrom: phase2Start,
          validTo: null,
          createdAt: stampOf(phase2Start),
          updatedAt: stampOf(phase2Start),
        },
      ]
    : base.habitTargets;

  const phase2Id = phase2.id;
  const habits: Habit[] = base.habits.map((h) =>
    h.phaseId === phase2Id
      ? { ...h, createdAt: stampOf(phase2Start), updatedAt: stampOf(phase2Start) }
      : h,
  );
  const activePhaseIds = new Set(
    phases.filter((p) => p.status === "active" || p.status === "completed").map((p) => p.id),
  );
  const targetsOf = (habitId: string) => habitTargets.filter((t) => t.habitId === habitId);
  const category = (key: string) =>
    base.categories[CATEGORY_SEEDS.findIndex((c) => c.key === key)].id;

  const dayStatus: DayStatus[] = [];
  const habitLogs: HabitLog[] = [];
  const activities: Activity[] = [];
  const metrics: Metric[] = [];

  const addMetric = (date: IsoDate, key: MetricKey, value: number | string) => {
    const isTime = typeof value === "string";
    metrics.push({
      id: newId(),
      createdAt: stampOf(date),
      updatedAt: stampOf(date),
      date,
      key,
      valueNum: isTime ? null : value,
      valueTime: isTime ? value : null,
    });
  };

  const addActivity = (
    date: IsoDate,
    title: string,
    categoryKey: string,
    from: number | null,
    to: number | null,
    extra: Partial<Activity> = {},
  ) => {
    const duration = from !== null && to !== null ? (to - from + 1440) % 1440 : null;
    activities.push({
      id: newId(),
      createdAt: stampOf(date, activities.length % 600),
      updatedAt: stampOf(date, activities.length % 600),
      title,
      categoryId: category(categoryKey),
      subcategory: null,
      date,
      startTime: from === null ? null : hhmm(from),
      endTime: to === null ? null : hhmm(to),
      durationMinutes: duration,
      place: null,
      people: [],
      notes: "",
      mood: null,
      energy: null,
      spend: null,
      tags: [],
      source: "web",
      rawMessageId: null,
      aiConfidence: null,
      confirmed: true,
      ...extra,
    });
  };

  const log = (habit: Habit, date: IsoDate, value: number | null, time: string | null) => {
    const score = scoreEntry(habit, targetOn(targetsOf(habit.id), date), { value, time }, 4);
    habitLogs.push({
      id: newId(),
      createdAt: stampOf(date, 600),
      updatedAt: stampOf(date, 600),
      habitId: habit.id,
      date,
      value,
      time,
      ...score,
      note: "",
      source: "web",
      rawMessageId: null,
    });
  };

  // Bed time for each night (minutes from midnight; > 1440 means after midnight).
  const bedAt = new Map<IsoDate, number>();
  for (let d = addDays(start, -1); d <= today; d = addDays(d, 1)) {
    const weekendNight = [4, 5].includes(weekdayIndex(d)); // Friday, Saturday
    bedAt.set(d, (weekendNight ? 24 * 60 + 10 : 23 * 60 + 5) + between(-40, 50));
  }

  for (let i = 0; i < DEMO_DAYS; i++) {
    const date = addDays(start, i);
    const isToday = date === today;
    const w = weekdayIndex(date);
    const weekend = w >= 5;
    const type: DayStatus["type"] = i === 17 ? "sick" : i === 41 ? "travel" : "normal";
    if (type !== "normal") {
      dayStatus.push({ date, type, note: "", updatedAt: stampOf(date) });
    }

    // ----- sleep -----
    const lastBed = bedAt.get(addDays(date, -1))!;
    const lateNight = lastBed > 23 * 60 + 30;
    const wake = lastBed + between(390, 500) - 1440; // minutes after midnight
    const bed = bedAt.get(date)!;
    addMetric(date, "wake_time", hhmm(wake));
    addMetric(
      date,
      "sleep_hours",
      Math.round((sleepMinutes(hhmm(lastBed), hhmm(wake)) / 60) * 100) / 100,
    );
    if (!isToday) addMetric(date, "bed_time", hhmm(bed));

    // ----- numbers -----
    const steps = isToday ? 2100 : Math.round(weekend ? between(7600, 11000) : between(2600, 6200));
    const reels = Math.round(25 + (45 * i) / (DEMO_DAYS - 1) + between(-10, 10));
    addMetric(date, "steps", steps);
    if (!isToday) {
      addMetric(date, "reels_minutes", reels);
      addMetric(date, "screen_time", Math.round(130 + reels + between(-20, 40)));
      addMetric(date, "water", Math.round(between(1.5, 3.1) * 4) / 4);
      addMetric(date, "mood", Math.round(lateNight ? between(2, 3.6) : between(3, 5)));
      addMetric(date, "energy", Math.round(lateNight ? between(1.6, 3.4) : between(3, 5)));
    }
    if (i % 3 === 0)
      addMetric(
        date,
        "weight",
        Math.round((74.2 - (1.6 * i) / DEMO_DAYS + between(-0.3, 0.3)) * 10) / 10,
      );

    // ----- habits -----
    const p = type !== "normal" ? 0.35 : lateNight ? 0.6 : 0.9;
    const breakfast = chance(p);
    for (const habit of habits) {
      if (!activePhaseIds.has(habit.phaseId) || habit.archived) continue;
      if (habit.phaseId === phase2Id && date < phase2Start) continue;
      if (isToday && !["morning", "anytime"].includes(habit.partOfDay)) continue;

      switch (habit.key) {
        case "wake_up":
          log(habit, date, null, hhmm(wake));
          continue;
        case "bedtime":
          if (!isToday) log(habit, date, null, hhmm(bed));
          continue;
        case "steps":
          log(habit, date, steps, null);
          continue;
        case "healthy_breakfast":
          if (breakfast) log(habit, date, 1, null);
          continue;
        case "skincare_morning":
        case "skincare_night":
          if (breakfast ? chance(p + 0.05) : chance(0.12)) log(habit, date, 1, null);
          continue;
        case "floss":
          if (chance([1, 2, 3].includes(w) ? 0.15 : 0.9)) log(habit, date, 1, null);
          continue;
        case "hair_care":
          if ([0, 3, 5].includes(w) && chance(0.85)) log(habit, date, 1, null);
          continue;
      }

      const target = targetOn(targetsOf(habit.id), date)?.targetValue ?? 1;
      if (habit.type === "boolean") {
        if (chance(p)) log(habit, date, 1, null);
      } else if (habit.type !== "time" && !habit.metricKey) {
        if (chance(p)) log(habit, date, Math.round(target * between(1, 1.3)), null);
        else if (chance(0.5))
          log(habit, date, Math.max(1, Math.round(target * between(0.3, 0.8))), null);
      }
    }

    // ----- activities -----
    if (isToday) {
      addActivity(date, "Morning tea and news", "meals", wake + 20, wake + 50);
      continue;
    }
    if (type === "sick") {
      addActivity(date, "Rested at home", "sleep", 11 * 60, 16 * 60);
      addActivity(date, "Doctor visit", "health", 17 * 60, 17 * 60 + 45, { place: "Clinic" });
    } else if (type === "travel") {
      addActivity(date, "Trip to Pune", "travel", 8 * 60, 18 * 60, { place: "Pune" });
      addActivity(date, "Dinner with cousins", "social", 20 * 60, 21 * 60 + 30);
    } else if (weekend) {
      addActivity(date, "Breakfast with family", "social", 9 * 60 + 30, 10 * 60 + 15);
      if (chance(0.7)) {
        const [title, place] = pick([
          ["Visited the fort", "Fort"],
          ["Beach walk", "Beach"],
          ["Old city market", "Market"],
          ["Lake trip", "Lake"],
        ] as const);
        addActivity(date, title, "travel", 16 * 60, 19 * 60 + 30, { place });
      }
      addActivity(date, "Family dinner", "social", 20 * 60, 21 * 60 + 30);
    } else {
      const shift = chance(0.5) ? 0 : 30;
      addActivity(date, "Job applications", "work", 10 * 60 + shift, 12 * 60 + shift);
      if (chance(0.25)) addActivity(date, "Interview", "work", 12 * 60 + 40, 13 * 60 + 10);
      addActivity(date, "Lunch", "meals", 13 * 60 + 30, 14 * 60 + 15);
      if (chance(0.6)) addActivity(date, "SQL course", "learning", 15 * 60, 17 * 60);
      if (chance(0.5)) addActivity(date, "Evening walk", "fitness", 18 * 60 + 30, 19 * 60 + 15);
      addActivity(date, "Dinner", "meals", 20 * 60 + 30, 21 * 60);
      if (chance(0.6))
        addActivity(date, "Watched a series", "entertainment", 21 * 60 + 15, 22 * 60 + 45);
    }
    addActivity(date, "Reels", "entertainment", null, null, { durationMinutes: reels });
    // One day with an overlap to fix (lunch inside a long café session).
    if (i === DEMO_DAYS - 6) {
      addActivity(date, "Worked from a café", "work", 11 * 60, 16 * 60, { place: "Café" });
    }
  }

  const file: BackupFile = {
    app: BACKUP_APP_ID,
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: stampOf(today),
    data: {
      phases,
      categories: base.categories,
      habits,
      habitTargets,
      habitLogs,
      dayStatus,
      activities,
      metrics,
      concerns: [],
      concernUpdates: [],
      healthReports: [],
      reportFiles: [],
      labValues: [],
      settings: { ...base.settings, seededAt: stampOf(start), updatedAt: stampOf(today) },
    },
  };
  // Same checks as a restored backup: demo data must be valid data.
  return backupFileSchema.parse(file);
}
