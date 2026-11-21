import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  eachDay,
  logicalDate,
  minutesIntoDay,
  monthRange,
  parseIsoDate,
  splitSpan,
  weekdayIndex,
  weekRange,
} from "./day";

const INDIA = { timeZone: "Asia/Kolkata", dayStartHour: 4 };

describe("logical day (4 AM rule)", () => {
  it("3:59 AM belongs to yesterday, 4:00 AM to today (India time)", () => {
    // 03:59 IST on 20 Nov = 22:29 UTC on 19 Nov
    expect(logicalDate(new Date("2026-11-19T22:29:00Z"), INDIA)).toBe("2026-11-19");
    expect(logicalDate(new Date("2026-11-19T22:30:00Z"), INDIA)).toBe("2026-11-20");
  });

  it("uses the time zone, not the computer's clock", () => {
    const instant = new Date("2026-11-20T03:59:00Z");
    expect(logicalDate(instant, { timeZone: "UTC", dayStartHour: 4 })).toBe("2026-11-19");
    expect(logicalDate(instant, INDIA)).toBe("2026-11-20"); // 09:29 in India
  });

  it("works across a year boundary", () => {
    // 02:00 IST on 1 Jan 2027
    expect(logicalDate(new Date("2026-12-31T20:30:00Z"), INDIA)).toBe("2026-12-31");
  });

  it("handles a daylight-saving jump (New York, 8 Mar 2026)", () => {
    const ny = { timeZone: "America/New_York", dayStartHour: 4 };
    expect(logicalDate(new Date("2026-03-08T07:30:00Z"), ny)).toBe("2026-03-07"); // 03:30 EDT
    expect(logicalDate(new Date("2026-03-08T08:00:00Z"), ny)).toBe("2026-03-08"); // 04:00 EDT
  });

  it("a midnight day start behaves like a normal calendar day", () => {
    expect(logicalDate(new Date("2026-11-19T18:31:00Z"), { ...INDIA, dayStartHour: 0 })).toBe(
      "2026-11-20",
    );
  });
});

describe("calendar dates", () => {
  it("adds and subtracts days across months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(diffDays("2026-12-01", "2026-11-20")).toBe(11);
  });

  it("rejects impossible dates", () => {
    expect(() => parseIsoDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseIsoDate("20/11/2026")).toThrow(RangeError);
  });

  it("numbers weekdays Monday = 0 … Sunday = 6", () => {
    expect(weekdayIndex("2026-11-16")).toBe(0); // Monday
    expect(weekdayIndex("2026-11-22")).toBe(6); // Sunday
  });

  it("builds weeks starting Monday or Sunday", () => {
    expect(weekRange("2026-11-20", "monday")).toEqual({ start: "2026-11-16", end: "2026-11-22" });
    expect(weekRange("2026-11-20", "sunday")).toEqual({ start: "2026-11-15", end: "2026-11-21" });
    expect(weekRange("2026-11-22", "monday").start).toBe("2026-11-16"); // Sunday ends a Monday week
  });

  it("builds months, including leap-year February", () => {
    expect(monthRange("2026-11-20")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(monthRange("2028-02-10").end).toBe("2028-02-29");
    expect(monthRange("2026-02-10").end).toBe("2026-02-28");
  });

  it("lists every day in a range", () => {
    expect(eachDay("2026-11-29", "2026-12-02")).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
    expect(eachDay("2026-11-20", "2026-11-19")).toEqual([]);
  });
});

describe("minutes into the day", () => {
  it("counts from the 4 AM day start", () => {
    expect(minutesIntoDay("04:00", 4)).toBe(0);
    expect(minutesIntoDay("23:30", 4)).toBe(1170);
    expect(minutesIntoDay("02:00", 4)).toBe(1320);
  });
});

describe("splitting spans across days", () => {
  it("splits sleep from 23:30 to 07:30 at 4 AM", () => {
    expect(splitSpan({ date: "2026-11-19", startTime: "23:30", endTime: "07:30" }, 4)).toEqual([
      { date: "2026-11-19", startMinute: 1170, endMinute: 1440 }, // 23:30–04:00 (4.5 h)
      { date: "2026-11-20", startMinute: 0, endMinute: 210 }, //    04:00–07:30 (3.5 h)
    ]);
  });

  it("keeps a span inside one day as one piece", () => {
    expect(splitSpan({ date: "2026-11-19", startTime: "17:00", endTime: "19:00" }, 4)).toEqual([
      { date: "2026-11-19", startMinute: 780, endMinute: 900 },
    ]);
  });

  it("treats 01:00–02:00 as late night of the same logical day", () => {
    expect(splitSpan({ date: "2026-11-19", startTime: "01:00", endTime: "02:00" }, 4)).toEqual([
      { date: "2026-11-19", startMinute: 1260, endMinute: 1320 },
    ]);
  });

  it("uses duration when there is no end time, even over several days", () => {
    const parts = splitSpan({ date: "2026-11-19", startTime: "03:00", durationMinutes: 3000 }, 4)!;
    // 03:00 + 50 h: 1 h on the 19th, two full days, 1 h on the 22nd.
    expect(parts.map((p) => p.date)).toEqual([
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(parts.map((p) => p.endMinute - p.startMinute)).toEqual([60, 1440, 1440, 60]);
    expect(parts.reduce((s, p) => s + p.endMinute - p.startMinute, 0)).toBe(3000);
  });

  it("can't place a span without a start time", () => {
    expect(splitSpan({ date: "2026-11-19", startTime: null, durationMinutes: 30 }, 4)).toBeNull();
  });
});
