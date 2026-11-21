import { describe, expect, it } from "vitest";
import type { Activity } from "@/data/schema";
import { activityFormSchema, emptyActivityForm, formToActivityDraft } from "./activity-form";
import { byTimeOfDay, formatDuration, parsePeople, parseTags, totalsByCategory } from "./summary";

const act = (over: Partial<Activity>): Activity => ({
  id: Math.random().toString(),
  createdAt: "2026-11-19T10:00:00.000Z",
  updatedAt: "2026-11-19T10:00:00.000Z",
  title: "x",
  categoryId: "c1",
  subcategory: null,
  date: "2026-11-19",
  startTime: null,
  endTime: null,
  durationMinutes: null,
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
  ...over,
});

describe("activity summaries", () => {
  it("totals minutes and entries per category, most time first", () => {
    const totals = totalsByCategory([
      act({ categoryId: "work", durationMinutes: 60 }),
      act({ categoryId: "work", durationMinutes: 30 }),
      act({ categoryId: "travel", durationMinutes: 240 }),
      act({ categoryId: "travel" }), // no duration: counts as an entry only
    ]);
    expect(totals).toEqual([
      { categoryId: "travel", entries: 2, minutes: 240 },
      { categoryId: "work", entries: 2, minutes: 90 },
    ]);
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(150)).toBe("2 h 30 min");
  });

  it("orders a day by start time, untimed entries last", () => {
    const list = [
      act({ title: "evening", startTime: "17:00" }),
      act({ title: "untimed" }),
      act({ title: "morning", startTime: "08:10" }),
    ].sort(byTimeOfDay);
    expect(list.map((a) => a.title)).toEqual(["morning", "evening", "untimed"]);
  });

  it("parses tags and people", () => {
    expect(parseTags("#Solo, with friends, #solo")).toEqual(["solo", "with-friends"]);
    expect(parsePeople("Riya, Sam ,, Riya")).toEqual(["Riya", "Sam"]);
  });
});

describe("activity form", () => {
  const valid = { ...emptyActivityForm("2026-11-19", "c1"), title: "Visited the fort" };

  it("needs a title and a category", () => {
    const r = activityFormSchema.safeParse(emptyActivityForm("2026-11-19"));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toEqual(["title", "categoryId"]);
  });

  it("an end time needs a start time", () => {
    const r = activityFormSchema.safeParse({ ...valid, endTime: "19:00" });
    expect(r.success).toBe(false);
  });

  it("converts text inputs into a draft", () => {
    const draft = formToActivityDraft({
      ...valid,
      startTime: "17:00",
      endTime: "19:00",
      place: " Fort ",
      people: "Riya, Sam",
      tags: "#solo",
      mood: "4",
      spend: "50",
    });
    expect(draft).toMatchObject({
      startTime: "17:00",
      endTime: "19:00",
      place: "Fort",
      people: ["Riya", "Sam"],
      tags: ["solo"],
      mood: 4,
      energy: null,
      spend: 50,
      subcategory: null,
    });
  });
});
