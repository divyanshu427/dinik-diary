import { z } from "zod";
import { copy } from "@/copy";
import type { ActivityDraft } from "@/data/activity-ops";
import type { Activity } from "@/data/schema";
import { parsePeople, parseTags } from "./summary";

/* The activity form keeps inputs as text, validates here, then converts to an ActivityDraft. */

const e = copy.pages.activities.form.errors;
const time = /^([01]\d|2[0-3]):[0-5]\d$/;
const scale = z.enum(["", "1", "2", "3", "4", "5"]);

export const activityFormSchema = z
  .object({
    title: z.string().trim().min(1, e.title),
    categoryId: z.string().min(1, e.category),
    subcategory: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, e.date),
    startTime: z.string(),
    endTime: z.string(),
    durationMinutes: z.string(),
    place: z.string(),
    people: z.string(),
    notes: z.string(),
    mood: scale,
    energy: scale,
    spend: z.string(),
    tags: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (v.startTime && !time.test(v.startTime)) issue("startTime", e.time);
    if (v.endTime && !time.test(v.endTime)) issue("endTime", e.time);
    if (v.endTime && !v.startTime) issue("startTime", e.endNeedsStart);
    if (v.durationMinutes.trim() !== "") {
      const n = Number(v.durationMinutes);
      if (!Number.isInteger(n) || n < 0 || n > 4320) issue("durationMinutes", e.duration);
    }
    if (v.spend.trim() !== "" && !(Number(v.spend) >= 0)) issue("spend", e.spend);
  });

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

export function emptyActivityForm(date: string, categoryId = ""): ActivityFormValues {
  return {
    title: "",
    categoryId,
    subcategory: "",
    date,
    startTime: "",
    endTime: "",
    durationMinutes: "",
    place: "",
    people: "",
    notes: "",
    mood: "",
    energy: "",
    spend: "",
    tags: "",
  };
}

export function activityToForm(a: Activity): ActivityFormValues {
  return {
    title: a.title,
    categoryId: a.categoryId,
    subcategory: a.subcategory ?? "",
    date: a.date,
    startTime: a.startTime ?? "",
    endTime: a.endTime ?? "",
    durationMinutes: a.durationMinutes == null ? "" : String(a.durationMinutes),
    place: a.place ?? "",
    people: a.people.join(", "),
    notes: a.notes,
    mood: a.mood == null ? "" : (String(a.mood) as ActivityFormValues["mood"]),
    energy: a.energy == null ? "" : (String(a.energy) as ActivityFormValues["energy"]),
    spend: a.spend == null ? "" : String(a.spend),
    tags: a.tags.join(", "),
  };
}

const orNull = (s: string) => (s.trim() === "" ? null : s.trim());
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export function formToActivityDraft(v: ActivityFormValues): ActivityDraft {
  return {
    title: v.title.trim(),
    categoryId: v.categoryId,
    subcategory: orNull(v.subcategory),
    date: v.date,
    startTime: orNull(v.startTime),
    endTime: orNull(v.endTime),
    // Recomputed from start/end when both are set (see withDuration).
    durationMinutes: numOrNull(v.durationMinutes),
    place: orNull(v.place),
    people: parsePeople(v.people),
    notes: v.notes.trim(),
    mood: numOrNull(v.mood),
    energy: numOrNull(v.energy),
    spend: numOrNull(v.spend),
    tags: parseTags(v.tags),
  };
}
