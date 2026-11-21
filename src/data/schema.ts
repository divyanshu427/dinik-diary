import { z } from "zod";
import { CHART_TOKENS } from "@/theme/tokens";

/*
 * Every table's shape, defined once with Zod. TypeScript types are inferred from these,
 * and every write (and every backup import) is validated against them.
 *
 * The same shapes are used in the browser database now and in Postgres later (plan.md §9).
 * Stage 2 adds user_id on the server; locally there is only one user.
 */

/**
 * 2: habits gained `partOfDay` (missing = "anytime").
 * 3: check-ins gained `note` (missing = ""). Older backups still import.
 * 4: phases gained `targetUpgrades` and `history` (missing = []).
 * 5: habits gained `pauses`; concerns became health issues (kind, body area, 0–10 scale,
 *    what helps / makes it worse, plan changes). Missing fields get their defaults.
 * 6: health reports, their files and the values typed from them (missing tables = empty).
 * 7: settings gained `lastBackupAt` and `backupReminderDays` (missing = never / 7 days).
 * 8: habits gained `startsOn` (missing = started from the beginning); settings gained
 *    `firstRunDone` (missing = true, so older data never sees the first-run picker).
 */
export const SCHEMA_VERSION = 8;

// ---------- building blocks ----------

/** A calendar day, "YYYY-MM-DD" (the logical day: before 4 AM counts as the previous day). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Expected YYYY-MM-DD");
/** A time of day, "HH:mm" (24 h). */
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");
export const timestamp = z.iso.datetime({ offset: true });
export const id = z.string().min(1);

const base = {
  id,
  createdAt: timestamp,
  updatedAt: timestamp,
};

export const colorToken = z.enum([...CHART_TOKENS, "chart-other"]);
export const source = z.enum(["web", "bot", "voice", "import"]);

// ---------- phases ----------

export const phaseStatus = z.enum(["locked", "active", "completed", "paused"]);

/** A target a phase sets on an existing habit when it's enabled (e.g. steps 5,000 → 8,000). */
export const targetUpgradeSchema = z.object({
  habitId: id,
  targetValue: z.number().nonnegative().nullable(),
  targetTime: timeOfDay.nullable(),
  graceMinutes: z.number().int().min(0),
});

const targetValues = targetUpgradeSchema.omit({ habitId: true });

/** Something that happened to a phase, for the history list and the unlock window. */
export const phaseEventSchema = z.object({
  date: isoDate,
  kind: z.enum(["started", "repeated", "paused", "resumed", "completed", "locked"]),
  /** Started before reaching the unlock target. */
  early: z.boolean().optional(),
  /** Targets changed when it started (kept so "lock again" can put them back). */
  changes: z
    .array(z.object({ habitId: id, from: targetValues.nullable(), to: targetValues }))
    .optional(),
});

export const phaseSchema = z.object({
  ...base,
  number: z.number().int().min(1),
  name: z.string().min(1),
  description: z.string(),
  status: phaseStatus,
  startedAt: timestamp.nullable(),
  endedAt: timestamp.nullable(),
  targetUpgrades: z.array(targetUpgradeSchema).default([]),
  history: z.array(phaseEventSchema).default([]),
});

// ---------- categories ----------

export const categorySchema = z.object({
  ...base,
  name: z.string().min(1),
  parentId: id.nullable(),
  colorToken,
  /** Optional custom colour that overrides the theme token. */
  customColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  /** Lucide icon name, e.g. "moon". */
  icon: z.string(),
  archived: z.boolean(),
  sortOrder: z.number().int(),
});

// ---------- habits ----------

/**
 * How a habit is measured. "Scheduled" is not a type: any habit can have a schedule
 * (see habitSchedule), e.g. a boolean "Hair wash" three times a week.
 */
export const habitType = z.enum(["boolean", "count", "duration", "numeric", "time"]);

export const habitSchedule = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("daily") }),
  /** Specific weekdays, 0 = Monday … 6 = Sunday. */
  z.object({ kind: z.literal("weekdays"), days: z.array(z.number().int().min(0).max(6)).min(1) }),
  /** Any days, N times per week. */
  z.object({ kind: z.literal("timesPerWeek"), times: z.number().int().min(1).max(7) }),
  /** Every N days counted from an anchor date. */
  z.object({ kind: z.literal("everyNDays"), every: z.number().int().min(2), anchor: isoDate }),
]);

export const metricKey = z.enum([
  "steps",
  "water",
  "weight",
  "sleep_hours",
  "bed_time",
  "wake_time",
  "screen_time",
  "reels_minutes",
  "mood",
  "energy",
]);

/** When in the day a habit happens. Used for filters and to group the Today checklist. */
export const PART_OF_DAY = ["anytime", "morning", "afternoon", "evening", "night"] as const;
export const partOfDay = z.enum(PART_OF_DAY);

export const habitSchema = z.object({
  ...base,
  /** Stable machine name, e.g. "brush_morning". Used by the bot/AI to refer to the habit. */
  key: z.string().regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and _"),
  name: z.string().min(1),
  description: z.string(),
  type: habitType,
  unit: z.string(),
  direction: z.enum(["higher_better", "lower_better"]),
  schedule: habitSchedule,
  phaseId: id,
  categoryId: id.nullable(),
  /** When set, the habit's value comes from this metric (no double entry). */
  metricKey: metricKey.nullable(),
  partOfDay: partOfDay.default("anytime"),
  /** Date ranges the habit is paused (e.g. for back pain): those days it isn't due. */
  pauses: z.array(z.object({ from: isoDate, to: isoDate })).default([]),
  /**
   * When the habit starts counting. A date: due from that day (earlier days are never missed).
   * null: not started yet (waiting in its phase). Missing: started from the beginning
   * (habits from before this existed).
   */
  startsOn: isoDate.nullable().optional(),
  archived: z.boolean(),
  sortOrder: z.number().int(),
});

/** Target history: a new row each time a target changes, so past days keep their old target. */
export const habitTargetSchema = z.object({
  ...base,
  habitId: id,
  targetValue: z.number().nonnegative().nullable(),
  targetTime: timeOfDay.nullable(),
  graceMinutes: z.number().int().min(0),
  validFrom: isoDate,
  validTo: isoDate.nullable(),
});

export const habitLogSchema = z.object({
  ...base,
  habitId: id,
  date: isoDate,
  value: z.number().nullable(),
  /** When it was done (for "wake up by 7:30" habits, this is what's scored). */
  time: timeOfDay.nullable(),
  done: z.boolean(),
  /** 0–100. Partial progress, e.g. 3 of 8 glasses = 37.5. */
  progress: z.number().min(0).max(100),
  /** Short note, e.g. "Guava" for breakfast. */
  note: z.string().max(200).default(""),
  source,
  rawMessageId: id.nullable(),
});

// ---------- days ----------

export const dayStatusSchema = z.object({
  date: isoDate,
  type: z.enum(["normal", "rest", "sick", "travel"]),
  note: z.string(),
  updatedAt: timestamp,
});

// ---------- activities ----------

export const activitySchema = z.object({
  ...base,
  title: z.string().min(1),
  categoryId: id,
  subcategory: z.string().nullable(),
  date: isoDate,
  startTime: timeOfDay.nullable(),
  endTime: timeOfDay.nullable(),
  durationMinutes: z.number().int().min(0).nullable(),
  place: z.string().nullable(),
  people: z.array(z.string()),
  notes: z.string(),
  mood: z.number().int().min(1).max(5).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  spend: z.number().min(0).nullable(),
  tags: z.array(z.string()),
  source,
  rawMessageId: id.nullable(),
  aiConfidence: z.number().min(0).max(1).nullable(),
  confirmed: z.boolean(),
});

// ---------- metrics ----------

export const metricSchema = z.object({
  ...base,
  date: isoDate,
  key: metricKey,
  valueNum: z.number().nullable(),
  valueTime: timeOfDay.nullable(),
});

// ---------- health (was "concerns") ----------

/** Pain (back pain), a symptom (headache, acidity) or a longer-term concern (hair fall, skin). */
export const healthKind = z.enum(["pain", "symptom", "concern"]);

/** 0 = none … 10 = worst. */
export const severity = z.number().int().min(0).max(10);

/**
 * A temporary change made by the "plan for the next few days", kept so it can end early
 * and so the screen can say what's active.
 */
export const healthAdjustmentSchema = z.object({
  id,
  /** ease = lower target, tighten = stricter "at most" limit, raise = a little more, pause. */
  kind: z.enum(["ease", "tighten", "raise", "pause"]),
  habitId: id,
  from: isoDate,
  /** Last day of the change. */
  to: isoDate,
  /** Target changes: the target before and during the change. */
  previous: targetUpgradeSchema.omit({ habitId: true }).nullable(),
  eased: targetUpgradeSchema.omit({ habitId: true }).nullable(),
  /** Set when it was ended early. */
  endedOn: isoDate.nullable(),
});

export const concernSchema = z.object({
  ...base,
  title: z.string().min(1),
  description: z.string(),
  kind: healthKind.default("concern"),
  bodyArea: z.string().default(""),
  /** How bad it was when added, 0–10. */
  severity,
  status: z.enum(["active", "improving", "resolved"]),
  startedAt: isoDate,
  /** What makes it worse, e.g. "sitting for hours". */
  worseWith: z.string().default(""),
  /** What helps, e.g. "stretching, a warm shower". */
  helpsWith: z.string().default(""),
  triedSoFar: z.string(),
  notes: z.string(),
  /** Habits that help (e.g. Stretching). */
  linkedHabitIds: z.array(id),
  /** Habits that may make it worse (e.g. Workout for back pain). */
  strainHabitIds: z.array(id).default([]),
  adjustments: z.array(healthAdjustmentSchema).default([]),
  /** Suggestions I said "not now" to. */
  dismissed: z.array(z.string()).default([]),
});

/** A check-in: how an issue was on a day (one per issue per day). */
export const concernUpdateSchema = z.object({
  ...base,
  concernId: id,
  date: isoDate,
  severity,
  note: z.string(),
  photoRef: z.string().nullable(),
});

// ---------- health reports (Build Phase 12.5) ----------

export const reportType = z.enum(["blood-test", "prescription", "scan", "doctor-note", "other"]);

/** A medical report: a blood test, a prescription, a scan… */
export const healthReportSchema = z.object({
  ...base,
  date: isoDate,
  title: z.string().min(1),
  type: reportType,
  /** Doctor or lab. */
  doctor: z.string(),
  notes: z.string(),
  /** Health issues it's about. */
  concernIds: z.array(id),
});

/** A photo or PDF of a report, kept in this browser (and in backups). */
export const reportFileSchema = z.object({
  ...base,
  reportId: id,
  name: z.string().min(1),
  mime: z.string(),
  size: z.number().int().min(0),
  /** The file itself, as a data: URL. */
  data: z.string().startsWith("data:"),
});

/** A value from a report (or measured at home), e.g. Vitamin D 18 ng/mL, normal 30–100. */
export const labValueSchema = z.object({
  ...base,
  date: isoDate,
  name: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  /** Normal range, as printed on the report. */
  low: z.number().nullable(),
  high: z.number().nullable(),
  /** The report it came from, or null for one I measured myself. */
  reportId: id.nullable(),
  note: z.string(),
});

// ---------- settings (one row) ----------

export const SETTINGS_ID = "settings";

export const settingsSchema = z.object({
  id: z.literal(SETTINGS_ID),
  timezone: z.string().min(1),
  /** Hour the day starts (0–23). 4 means 3:59 AM still counts as yesterday. */
  dayStartHour: z.number().int().min(0).max(23),
  weekStart: z.enum(["monday", "sunday"]),
  reminderTime: timeOfDay,
  timeBase: z.enum(["day", "waking"]),
  /** Average progress % needed to unlock the next phase. */
  unlockThreshold: z.number().min(1).max(100),
  windowDays: z.number().int().min(1),
  minLoggedDays: z.number().int().min(1),
  themePreset: z.string().min(1),
  colorMode: z.enum(["light", "dark", "system"]),
  units: z.enum(["metric", "imperial"]),
  aiProvider: z.enum(["gemini", "groq", "openrouter", "none"]),
  featureFlags: z.object({
    bot: z.boolean(),
    aiParsing: z.boolean(),
    voice: z.boolean(),
    coach: z.boolean(),
  }),
  /** When a backup was last downloaded (null = never). */
  lastBackupAt: timestamp.nullable().default(null),
  /** Remind me to download a backup after this many days (0 = never remind). */
  backupReminderDays: z.number().int().min(0).max(60).default(7),
  /** The first-run "Which habits do you want to start with?" has been answered. */
  firstRunDone: z.boolean().default(true),
  /** When the starter data was first created on this device. */
  seededAt: timestamp,
  updatedAt: timestamp,
});

// ---------- types ----------

export type Phase = z.infer<typeof phaseSchema>;
export type PhaseStatus = z.infer<typeof phaseStatus>;
export type PhaseEvent = z.infer<typeof phaseEventSchema>;
export type TargetUpgrade = z.infer<typeof targetUpgradeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type ColorToken = z.infer<typeof colorToken>;
export type Habit = z.infer<typeof habitSchema>;
export type HabitType = z.infer<typeof habitType>;
export type HabitSchedule = z.infer<typeof habitSchedule>;
export type PartOfDay = z.infer<typeof partOfDay>;
export type HabitTarget = z.infer<typeof habitTargetSchema>;
export type HabitLog = z.infer<typeof habitLogSchema>;
export type DayStatus = z.infer<typeof dayStatusSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Metric = z.infer<typeof metricSchema>;
export type MetricKey = z.infer<typeof metricKey>;
export type Concern = z.infer<typeof concernSchema>;
export type ConcernUpdate = z.infer<typeof concernUpdateSchema>;
export type HealthKind = z.infer<typeof healthKind>;
export type HealthAdjustment = z.infer<typeof healthAdjustmentSchema>;
export type HealthReport = z.infer<typeof healthReportSchema>;
export type ReportType = z.infer<typeof reportType>;
export type ReportFile = z.infer<typeof reportFileSchema>;
export type LabValue = z.infer<typeof labValueSchema>;
export type Settings = z.infer<typeof settingsSchema>;

/** Fields the data layer fills in itself. */
export type AutoFields = "id" | "createdAt" | "updatedAt";
export type NewRow<T> = Omit<T, AutoFields> & { id?: string };
export type RowPatch<T> = Partial<Omit<T, AutoFields>>;
