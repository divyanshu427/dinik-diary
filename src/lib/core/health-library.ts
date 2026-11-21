import type { HealthKind, PartOfDay } from "@/data/schema";

/*
 * What the app knows about common health issues (Build Phase 12), so I only have to say
 * what's wrong. Each profile says which kinds of habits usually make it worse, which help,
 * and what to raise a little while it lasts. Habits are matched by name, so it works with my
 * own habits too, not just the starter ones. The words shown on screen live in the copy file
 * (copy.pages.health.library[id]).
 *
 * Stage 2: an AI advisor can replace these rules; it returns the same kind of suggestions.
 */

export interface IssueProfile {
  id: string;
  kind: HealthKind;
  /** Words in the issue's name that point to this profile. */
  words: RegExp;
  /** Habits that usually make it worse: lighter target, tighter limit, or paused for a few days. */
  strain?: RegExp;
  /** Habits that usually help: kept as they are, and suggested when missing. */
  helps?: RegExp;
  /** Habits to raise a little while it lasts (e.g. water for a headache). */
  raise?: RegExp;
  /** A habit to suggest when nothing helpful is on the checklist. */
  helper?: {
    type: "duration" | "boolean" | "count";
    target: number | null;
    unit: string;
    partOfDay: PartOfDay;
  };
  /** The level from which the routine changes (default 6, two check-ins in a row). */
  actAt?: number;
}

const HARD_EXERCISE =
  /workout|gym|weights|weight ?(?:lift|training)|\blift|run\b|running|jog|\bsports?\b|cricket|football|badminton|tennis|hiit/;
const SCREENS = /\bscreen|\breels|\bphone\b|social media|instagram|youtube/;

export const ISSUE_PROFILES: readonly IssueProfile[] = [
  {
    id: "back",
    kind: "pain",
    words: /back|spine|sciatica|kamar|lumbar/,
    strain: HARD_EXERCISE,
    helps: /stretch|yoga|walk|steps|posture|mobility/,
    helper: { type: "duration", target: 10, unit: "", partOfDay: "evening" },
  },
  {
    id: "neck",
    kind: "pain",
    words: /neck|shoulder|cervical/,
    strain: new RegExp(`${HARD_EXERCISE.source}|${SCREENS.source}`),
    helps: /stretch|posture|yoga|mobility/,
    helper: { type: "duration", target: 5, unit: "", partOfDay: "anytime" },
  },
  {
    id: "joints",
    kind: "pain",
    words: /knee|ankle|joint|leg|foot|feet|hip|heel|wrist|elbow/,
    strain: new RegExp(`${HARD_EXERCISE.source}|steps|walk`),
    helps: /stretch|mobility|yoga|swim/,
    helper: { type: "duration", target: 10, unit: "", partOfDay: "evening" },
  },
  {
    id: "headache",
    kind: "symptom",
    words: /headache|migraine|head ?ache|head pain/,
    strain: SCREENS,
    helps: /water|sleep|meditation|breath|walk|bed on time/,
    raise: /water|sleep/,
    helper: { type: "count", target: 8, unit: "glasses", partOfDay: "anytime" },
  },
  {
    id: "eyes",
    kind: "symptom",
    words: /\beyes?\b|vision|eye strain/,
    strain: SCREENS,
    helps: /eye|sleep/,
    helper: { type: "count", target: 4, unit: "breaks", partOfDay: "anytime" },
  },
  {
    id: "stomach",
    kind: "symptom",
    words:
      /acid|gas\b|heartburn|bloat|stomach|indigestion|gastric|constipation|digest|loose motion/,
    strain: /coffee|tea\b|spicy|junk|sugary|late.?night/,
    helps: /fruit|vegetable|breakfast|water|walk|junk|sugary|late.?night/,
    raise: /water/,
    helper: { type: "boolean", target: null, unit: "", partOfDay: "night" },
  },
  {
    id: "cold",
    kind: "symptom",
    words: /cold|cough|fever|flu|throat|viral|infection|sneez|runny nose/,
    strain: new RegExp(`${HARD_EXERCISE.source}|steps|yoga`),
    helps: /sleep|water|rest|bed on time/,
    raise: /water|sleep/,
    helper: { type: "boolean", target: null, unit: "", partOfDay: "anytime" },
    actAt: 5,
  },
  {
    id: "tired",
    kind: "symptom",
    words: /tired|fatigue|exhaust|low energy|weakness|\bweak\b|drained/,
    strain: HARD_EXERCISE,
    helps: /sleep|walk|breakfast|water|bed on time/,
    raise: /sleep/,
    helper: { type: "duration", target: 10, unit: "", partOfDay: "morning" },
  },
  {
    id: "sleep",
    kind: "symptom",
    words: /insomnia|can'?t sleep|cannot sleep|sleep problem|poor sleep|sleepless|bad sleep/,
    strain: new RegExp(`${SCREENS.source}|coffee`),
    helps: /no phone|meditation|breath|bed on time|read|wind.?down/,
    helper: { type: "duration", target: 15, unit: "", partOfDay: "night" },
  },
  {
    id: "stress",
    kind: "symptom",
    words: /stress|anxiety|anxious|panic|low mood|\bsad\b|depress|overwhelm|tension/,
    strain: SCREENS,
    helps: /meditation|breath|walk|journal|call family|partner|hobby|read/,
    helper: { type: "duration", target: 5, unit: "", partOfDay: "anytime" },
  },
  {
    id: "hair",
    kind: "concern",
    words: /hair|dandruff|scalp|bald/,
    helps: /protein|sleep|hair|fruit|vegetable|water/,
    helper: { type: "boolean", target: null, unit: "", partOfDay: "anytime" },
  },
  {
    id: "skin",
    kind: "concern",
    words: /skin|acne|pimple|rash|eczema|dry patch|itch|dark circle/,
    helps: /face wash|skincare|moisturi[sz]er|sunscreen|water|sugary|fruit|vegetable|sleep/,
    raise: /water/,
    helper: { type: "boolean", target: null, unit: "", partOfDay: "night" },
  },
  // Any other pain: go easy on hard exercise.
  {
    id: "pain",
    kind: "pain",
    words: /pain|ache|sore|hurt|injur|sprain|cramp|strain/,
    strain: HARD_EXERCISE,
    helps: /stretch|rest/,
  },
];

/** The profile an issue's name points to, or null for something the app doesn't know. */
export function profileFor(title: string): IssueProfile | null {
  const text = title.toLowerCase();
  return ISSUE_PROFILES.find((p) => p.words.test(text)) ?? null;
}

/** "No sugary drinks", "No late-night junk": habits of avoiding something. They always help. */
export const isAvoidanceHabit = (name: string) => /^\s*no\b/i.test(name);

export type HabitRole = "strain" | "helps" | "raise";

/** How a habit relates to an issue, from the library (by the habit's name and key). */
export function libraryRole(
  profile: IssueProfile,
  habit: { name: string; key: string },
): HabitRole | null {
  const text = `${habit.name} ${habit.key.replace(/_/g, " ")}`.toLowerCase();
  const avoids = isAvoidanceHabit(habit.name);
  if (!avoids && profile.strain?.test(text)) return "strain";
  if (!avoids && profile.raise?.test(text)) return "raise";
  if (profile.helps?.test(text)) return "helps";
  return null;
}
