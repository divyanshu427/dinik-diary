import { describe, expect, it } from "vitest";
import type { Activity, Metric } from "@/data/schema";
import { buildReport, type ReportData } from "@/lib/core";
import { csvCell, reportCsv } from "./report-csv";

const TS = "2026-11-01T06:30:00.000Z";
const act = (over: Partial<Activity>): Activity => ({
  id: Math.random().toString(),
  createdAt: TS,
  updatedAt: TS,
  title: "x",
  categoryId: "work",
  subcategory: null,
  date: "2026-11-10",
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
const metric = (date: string, key: Metric["key"], value: number | string): Metric => ({
  id: `${date}${key}`,
  createdAt: TS,
  updatedAt: TS,
  date,
  key,
  valueNum: typeof value === "number" ? value : null,
  valueTime: typeof value === "string" ? value : null,
});

describe("CSV cells", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Lunch, then nap")).toBe('"Lunch, then nap"');
    expect(csvCell('The "fort"')).toBe('"The ""fort"""');
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(null)).toBe("");
  });

  it("never lets text start a spreadsheet formula", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+91 trip")).toBe("'+91 trip");
    expect(csvCell(-5)).toBe("-5"); // real numbers are fine
  });
});

describe("report CSV", () => {
  it("one row per day with habits, minutes per category, unlogged time and numbers", () => {
    const metrics = [
      metric("2026-11-09", "bed_time", "23:30"),
      metric("2026-11-10", "wake_time", "07:30"),
      metric("2026-11-10", "steps", 6200),
    ];
    const data: ReportData = {
      habits: [],
      targetsByHabit: new Map(),
      logs: [],
      dayStatuses: [{ date: "2026-11-11", type: "sick", note: "", updatedAt: TS }],
      activities: [
        act({ date: "2026-11-10", categoryId: "work", startTime: "09:00", endTime: "17:00" }),
      ],
      metrics,
      sleepCategoryId: "sleep",
    };
    const report = buildReport(
      data,
      { start: "2026-11-10", end: "2026-11-11" },
      {
        timeZone: "Asia/Kolkata",
        dayStartHour: 4,
        weekStart: "monday",
        threshold: 80,
        today: "2026-11-20",
      },
    );
    const csv = reportCsv({
      report,
      metrics,
      categories: [
        { id: "sleep", name: "Sleep and rest" },
        { id: "work", name: "Work, jobs" },
        { id: "fun", name: "Entertainment" },
      ],
      today: "2026-11-20",
      nowMinute: null,
    });
    const [header, day1, day2] = csv.trim().split("\r\n");
    expect(header).toBe(
      'Date,Day type,Habits done,Habits due,Average progress (%),Sleep (min),"Work, jobs (min)",Unlogged (min),Steps,Water (L),Weight,Sleep (h),Bed time,Wake time,Screen time (min),Reels (min),Mood (1-5),Energy (1-5)',
    );
    // 3.5 h of last night's sleep after 4 AM, 8 h of work, the rest unlogged.
    expect(day1).toBe("2026-11-10,Normal,,,,210,480,750,6200,,,,,07:30,,,,");
    expect(day2).toBe("2026-11-11,Sick,,,,0,0,1440,,,,,,,,,,");
  });
});
