import type {
  PartOfDay,
  Category,
  ColorToken,
  Habit,
  HabitSchedule,
  HabitTarget,
  HabitType,
  MetricKey,
  Phase,
  Settings,
} from "../schema";
import { logicalDate } from "@/lib/core/day";
import { SETTINGS_ID } from "../schema";

/*
 * Starter data loaded on first run (and by "Reset to defaults").
 * Nothing here is fixed: every phase, habit and category can be edited later in the app.
 * Source: plan.md §4 (habit phases) and §6.3 (categories).
 */

// ---------- categories ----------

interface CategorySeed {
  key: string;
  name: string;
  icon: string;
  colorToken: ColorToken;
}

/** The 8 most-used categories get their own chart colour; the rest share "Other" grey. */
export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  { key: "sleep", name: "Sleep and rest", icon: "moon", colorToken: "chart-1" },
  { key: "meals", name: "Meals and food", icon: "utensils", colorToken: "chart-2" },
  { key: "work", name: "Work and job search", icon: "briefcase", colorToken: "chart-3" },
  { key: "travel", name: "Travel and exploration", icon: "map", colorToken: "chart-4" },
  { key: "learning", name: "Learning and study", icon: "graduation-cap", colorToken: "chart-5" },
  { key: "entertainment", name: "Entertainment", icon: "clapperboard", colorToken: "chart-6" },
  { key: "fitness", name: "Fitness and exercise", icon: "dumbbell", colorToken: "chart-7" },
  { key: "social", name: "Social and family", icon: "users", colorToken: "chart-8" },
  { key: "grooming", name: "Grooming and hygiene", icon: "sparkles", colorToken: "chart-other" },
  { key: "mind", name: "Mind and wellness", icon: "brain", colorToken: "chart-other" },
  { key: "chores", name: "Chores and errands", icon: "shopping-basket", colorToken: "chart-other" },
  { key: "hobbies", name: "Hobbies and creative", icon: "palette", colorToken: "chart-other" },
  { key: "finance", name: "Finance and admin", icon: "wallet", colorToken: "chart-other" },
  {
    key: "health",
    name: "Health and appointments",
    icon: "stethoscope",
    colorToken: "chart-other",
  },
  { key: "other", name: "Other", icon: "circle-help", colorToken: "chart-other" },
];

type CategoryKey = (typeof CATEGORY_SEEDS)[number]["key"];

// ---------- phases and habits ----------

interface HabitSeed {
  key: string;
  name: string;
  type: HabitType;
  category: CategoryKey;
  target?: number;
  targetTime?: string;
  grace?: number;
  unit?: string;
  direction?: "higher_better" | "lower_better";
  schedule?: HabitSchedule;
  metricKey?: MetricKey;
  description?: string;
}

interface PhaseSeed {
  name: string;
  description: string;
  habits: HabitSeed[];
  /** Targets this phase raises on earlier habits when it's enabled. */
  upgrades?: { key: string; target: number }[];
}

const DAILY: HabitSchedule = { kind: "daily" };

export const PHASE_SEEDS: readonly PhaseSeed[] = [
  {
    name: "Foundation",
    description:
      "The basics: wake up, water, hygiene, breakfast, a short walk and a fixed bedtime.",
    habits: [
      {
        key: "wake_up",
        name: "Wake up on time",
        type: "time",
        category: "sleep",
        targetTime: "07:30",
        grace: 15,
        metricKey: "wake_time",
      },
      {
        key: "morning_water",
        name: "Water first thing in the morning",
        type: "boolean",
        category: "meals",
      },
      {
        key: "water_goal",
        name: "Water goal",
        type: "numeric",
        category: "meals",
        target: 3,
        unit: "L",
        metricKey: "water",
      },
      { key: "healthy_breakfast", name: "Healthy breakfast", type: "boolean", category: "meals" },
      { key: "bath", name: "Bath", type: "boolean", category: "grooming" },
      {
        key: "brush_morning",
        name: "Brush teeth — morning",
        type: "boolean",
        category: "grooming",
      },
      { key: "brush_night", name: "Brush teeth — night", type: "boolean", category: "grooming" },
      {
        key: "skincare_morning",
        name: "Face wash — morning",
        type: "boolean",
        category: "grooming",
      },
      { key: "skincare_night", name: "Face wash — night", type: "boolean", category: "grooming" },
      {
        key: "steps",
        name: "Daily steps",
        type: "numeric",
        category: "fitness",
        target: 5000,
        unit: "steps",
        metricKey: "steps",
      },
      {
        key: "bedtime",
        name: "In bed on time",
        type: "time",
        category: "sleep",
        targetTime: "23:30",
        grace: 15,
        metricKey: "bed_time",
      },
    ],
  },
  {
    name: "Fitness and grooming",
    description:
      "Move more and build a grooming routine. Your daily steps target goes up to 8,000.",
    upgrades: [{ key: "steps", target: 8000 }],
    habits: [
      {
        key: "workout",
        name: "Workout or yoga",
        type: "duration",
        category: "fitness",
        target: 30,
        unit: "min",
      },
      {
        key: "stretching",
        name: "Stretching",
        type: "duration",
        category: "fitness",
        target: 10,
        unit: "min",
      },
      {
        key: "moisturiser_sunscreen",
        name: "Moisturiser and sunscreen",
        type: "boolean",
        category: "grooming",
      },
      {
        key: "hair_care",
        name: "Hair care routine (wash or oil)",
        type: "boolean",
        category: "grooming",
        schedule: { kind: "timesPerWeek", times: 3 },
      },
      { key: "floss", name: "Floss", type: "boolean", category: "grooming" },
      {
        key: "protein",
        name: "Protein with each meal",
        type: "count",
        category: "meals",
        target: 3,
        unit: "meals",
      },
      { key: "no_sugary_drinks", name: "No sugary drinks", type: "boolean", category: "meals" },
    ],
  },
  {
    name: "Sleep and mind",
    description: "Better sleep, less screen time and a calmer mind.",
    habits: [
      {
        key: "sleep_hours",
        name: "Enough sleep",
        type: "numeric",
        category: "sleep",
        target: 7,
        unit: "hours",
        metricKey: "sleep_hours",
      },
      {
        key: "no_phone_before_bed",
        name: "No phone 30 minutes before bed",
        type: "boolean",
        category: "sleep",
      },
      {
        key: "meditation",
        name: "Meditation or breathing",
        type: "duration",
        category: "mind",
        target: 10,
        unit: "min",
      },
      {
        key: "screen_time",
        name: "Screen time limit",
        type: "numeric",
        category: "entertainment",
        target: 180,
        unit: "min",
        direction: "lower_better",
        metricKey: "screen_time",
      },
      {
        key: "reels_limit",
        name: "Reels limit",
        type: "numeric",
        category: "entertainment",
        target: 30,
        unit: "min",
        direction: "lower_better",
        metricKey: "reels_minutes",
      },
      {
        key: "fruits_vegetables",
        name: "Fruits and vegetables",
        type: "boolean",
        category: "meals",
      },
      { key: "no_late_junk", name: "No late-night junk food", type: "boolean", category: "meals" },
    ],
  },
  {
    name: "Work and growth",
    description: "Focus, learning and a clear end to the work day.",
    habits: [
      {
        key: "top_three",
        name: "Top 3 priorities done",
        type: "count",
        category: "work",
        target: 3,
        unit: "tasks",
      },
      {
        key: "learning_time",
        name: "Learning time",
        type: "duration",
        category: "learning",
        target: 60,
        unit: "min",
        description: "React, Next.js or whatever you're learning.",
      },
      {
        key: "job_search",
        name: "Work or job-search block",
        type: "duration",
        category: "work",
        target: 60,
        unit: "min",
      },
      { key: "shutdown_ritual", name: "Shutdown ritual", type: "boolean", category: "work" },
      { key: "journaling", name: "Journaling", type: "boolean", category: "mind" },
      { key: "expenses_logged", name: "Expenses logged", type: "boolean", category: "finance" },
      { key: "plan_tomorrow", name: "Plan tomorrow", type: "boolean", category: "work" },
    ],
  },
  {
    name: "Life and finishing touches",
    description: "People, hobbies and the small things that keep life running.",
    habits: [
      { key: "call_family", name: "Call family", type: "boolean", category: "social" },
      {
        key: "partner_time",
        name: "Quality time with partner",
        type: "boolean",
        category: "social",
      },
      {
        key: "hobby_time",
        name: "Hobby time",
        type: "duration",
        category: "hobbies",
        target: 30,
        unit: "min",
      },
      {
        key: "beard_nails",
        name: "Beard trim and nails",
        type: "boolean",
        category: "grooming",
        schedule: { kind: "everyNDays", every: 10, anchor: "2026-01-01" },
      },
      { key: "clean_clothes", name: "Clean clothes ready", type: "boolean", category: "chores" },
      { key: "posture_check", name: "Posture check", type: "boolean", category: "health" },
      {
        key: "weight_check",
        name: "Weekly weight check",
        type: "boolean",
        category: "health",
        schedule: { kind: "weekdays", days: [6] },
      },
      {
        key: "read",
        name: "Read",
        type: "duration",
        category: "learning",
        target: 20,
        unit: "min",
      },
    ],
  },
];

/**
 * Part of day for each starter habit (by key). Also used by the database upgrade that added
 * part of day, so habits created before it get the same sensible values.
 */
export const PART_OF_DAY_BY_KEY: Readonly<Record<string, PartOfDay>> = {
  wake_up: "morning",
  morning_water: "morning",
  healthy_breakfast: "morning",
  bath: "morning",
  brush_morning: "morning",
  brush_night: "night",
  skincare_morning: "morning",
  skincare_night: "night",
  steps: "anytime",
  bedtime: "night",
  workout: "anytime",
  stretching: "anytime",
  moisturiser_sunscreen: "morning",
  hair_care: "anytime",
  floss: "night",
  protein: "anytime",
  no_sugary_drinks: "anytime",
  sleep_hours: "night",
  no_phone_before_bed: "night",
  meditation: "anytime",
  screen_time: "anytime",
  reels_limit: "anytime",
  fruits_vegetables: "anytime",
  water_goal: "anytime",
  no_late_junk: "night",
  top_three: "anytime",
  learning_time: "anytime",
  job_search: "anytime",
  shutdown_ritual: "evening",
  journaling: "night",
  expenses_logged: "evening",
  plan_tomorrow: "evening",
  call_family: "evening",
  partner_time: "evening",
  hobby_time: "evening",
  beard_nails: "anytime",
  clean_clothes: "night",
  posture_check: "anytime",
  weight_check: "morning",
  read: "night",
};

// ---------- settings ----------

export interface SeedOptions {
  /** ISO timestamp used for createdAt/updatedAt. */
  now: string;
  newId: () => string;
  /** Keep the theme the user already picked (it lives in localStorage before the DB exists). */
  theme?: { preset: string; mode: Settings["colorMode"] };
}

export function defaultSettings(now: string, theme?: SeedOptions["theme"]): Settings {
  return {
    id: SETTINGS_ID,
    timezone: "Asia/Kolkata",
    dayStartHour: 4,
    weekStart: "monday",
    reminderTime: "21:30",
    timeBase: "day",
    unlockThreshold: 80,
    windowDays: 14,
    minLoggedDays: 10,
    themePreset: theme?.preset ?? "sage",
    colorMode: theme?.mode ?? "system",
    units: "metric",
    aiProvider: "gemini",
    featureFlags: { bot: false, aiParsing: false, voice: false, coach: false },
    lastBackupAt: null,
    backupReminderDays: 7,
    seededAt: now,
    updatedAt: now,
  };
}

// ---------- build ----------

export interface SeedData {
  phases: Phase[];
  categories: Category[];
  habits: Habit[];
  habitTargets: HabitTarget[];
  settings: Settings;
}

/** Builds the full starter data set. Pure: same options in, same rows out. */
/** Starter targets apply to every past day too, so back-filled days are scored. */
export const SEED_TARGET_FROM = "2000-01-01";

export function buildSeed({ now, newId, theme }: SeedOptions): SeedData {
  const stamp = { createdAt: now, updatedAt: now };
  const defaults = defaultSettings(now, theme);
  const seedDate = logicalDate(new Date(now), {
    timeZone: defaults.timezone,
    dayStartHour: defaults.dayStartHour,
  });

  const categories: Category[] = CATEGORY_SEEDS.map((c, i) => ({
    id: newId(),
    ...stamp,
    name: c.name,
    parentId: null,
    colorToken: c.colorToken,
    customColor: null,
    icon: c.icon,
    archived: false,
    sortOrder: i,
  }));
  const categoryId = (key: CategoryKey) =>
    categories[CATEGORY_SEEDS.findIndex((c) => c.key === key)].id;

  const phases: Phase[] = [];
  const habits: Habit[] = [];
  const habitTargets: HabitTarget[] = [];

  PHASE_SEEDS.forEach((p, pi) => {
    const phase: Phase = {
      id: newId(),
      ...stamp,
      number: pi + 1,
      name: p.name,
      description: p.description,
      status: pi === 0 ? "active" : "locked",
      startedAt: pi === 0 ? now : null,
      endedAt: null,
      targetUpgrades: [],
      history: pi === 0 ? [{ date: seedDate, kind: "started" }] : [],
    };
    phases.push(phase);

    p.habits.forEach((h, hi) => {
      const habit: Habit = {
        id: newId(),
        ...stamp,
        key: h.key,
        name: h.name,
        description: h.description ?? "",
        type: h.type,
        unit: h.unit ?? "",
        direction: h.direction ?? "higher_better",
        schedule: h.schedule ?? DAILY,
        phaseId: phase.id,
        categoryId: categoryId(h.category),
        metricKey: h.metricKey ?? null,
        partOfDay: PART_OF_DAY_BY_KEY[h.key] ?? "anytime",
        pauses: [],
        archived: false,
        sortOrder: hi,
      };
      habits.push(habit);
      habitTargets.push({
        id: newId(),
        ...stamp,
        habitId: habit.id,
        targetValue: h.type === "boolean" || h.type === "time" ? null : (h.target ?? null),
        targetTime: h.type === "time" ? (h.targetTime ?? null) : null,
        graceMinutes: h.grace ?? 0,
        validFrom: SEED_TARGET_FROM,
        validTo: null,
      });
    });
  });

  // Target upgrades point at habits by id, so they're filled in once every habit exists.
  PHASE_SEEDS.forEach((p, pi) => {
    phases[pi].targetUpgrades = (p.upgrades ?? []).flatMap(({ key, target }) => {
      const habit = habits.find((h) => h.key === key);
      return habit
        ? [{ habitId: habit.id, targetValue: target, targetTime: null, graceMinutes: 0 }]
        : [];
    });
  });

  return { phases, categories, habits, habitTargets, settings: defaultSettings(now, theme) };
}
