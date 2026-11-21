import { describe, expect, it } from "vitest";
import type { Activity, Metric } from "@/data/schema";
import { buildDayTimeline } from "./day-timeline";

const at = (hour: number, minute = 0) => ((hour - 4 + 24) % 24) * 60 + minute;

let n = 0;
const act = (over: Partial<Activity>): Activity => ({
  id: `a${++n}`,
  createdAt: `2026-11-20T10:00:${String(n).padStart(2, "0")}.000Z`,
  updatedAt: "2026-11-20T10:00:00.000Z",
  title: "x",
  categoryId: "c1",
  subcategory: null,
  date: "2026-11-20",
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

const metric = (date: string, key: Metric["key"], valueTime: string): Metric => ({
  id: `${date}-${key}`,
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
  date,
  key,
  valueNum: null,
  valueTime,
});

const base = { date: "2026-11-20", dayStartHour: 4, nowMinute: null };

describe("day timeline", () => {
  it("shows last night's sleep, the activities and a 3-hour gap", () => {
    const t = buildDayTimeline({
      ...base,
      metrics: [
        metric("2026-11-19", "bed_time", "23:30"),
        metric("2026-11-20", "wake_time", "07:30"),
      ],
      activities: [
        act({ title: "Applications", startTime: "07:30", endTime: "14:00" }),
        act({ title: "Visited the fort", startTime: "17:00", endTime: "23:00" }),
        act({ title: "Watched a movie", durationMinutes: 120 }),
      ],
    });
    expect(t.items.map((i) => (i.kind === "activity" ? i.activity.title : i.kind))).toEqual([
      "sleep",
      "Applications",
      "gap",
      "Visited the fort",
    ]);
    const sleep = t.items[0];
    expect(sleep.kind === "sleep" && sleep.sleep.minutes).toBe(480);
    expect(t.gaps).toEqual([{ start: at(14), end: at(17) }]);
    expect(t.untimed.map((a) => a.title)).toEqual(["Watched a movie"]);
  });

  it("today, gaps stop at the current time", () => {
    const t = buildDayTimeline({
      ...base,
      nowMinute: at(12),
      metrics: [metric("2026-11-20", "wake_time", "07:00")],
      activities: [act({ startTime: "07:00", endTime: "08:00" })],
    });
    expect(t.gaps).toEqual([{ start: at(8), end: at(12) }]);
  });

  it("places yesterday's late entry in the first hours of today", () => {
    const t = buildDayTimeline({
      ...base,
      metrics: [],
      activities: [
        act({ date: "2026-11-19", title: "Party", startTime: "22:00", endTime: "05:00" }),
      ],
    });
    expect(t.items[0]).toMatchObject({ kind: "activity", start: 0, end: at(5), continued: true });
  });

  it("reports overlaps between this day's entries", () => {
    const t = buildDayTimeline({
      ...base,
      metrics: [],
      activities: [
        act({ title: "Work", startTime: "09:00", endTime: "17:00" }),
        act({ title: "Lunch", startTime: "13:00", endTime: "14:00" }),
      ],
    });
    expect(t.overlaps.map((o) => [o.winner.title, o.loser.title])).toEqual([["Lunch", "Work"]]);
    expect(t.items.filter((i) => i.kind === "activity")).toHaveLength(3);
  });
});
