import { describe, expect, it } from "vitest";
import {
  blockOf,
  findGaps,
  minuteToTime,
  overlapRemainder,
  resolveOverlaps,
  sleepMinutes,
  sleepSegments,
} from "./timeline";

const H = 60;
/** Minutes into a 4 AM day for a clock hour, e.g. at(14) = 600. */
const at = (hour: number, minute = 0) => ((hour - 4 + 24) % 24) * H + minute;

describe("placing entries", () => {
  it("uses the end time, or start + duration; past midnight stays on the same day", () => {
    expect(blockOf({ startTime: "17:00", endTime: "19:00" }, 4)).toEqual({
      start: at(17),
      end: at(19),
    });
    expect(blockOf({ startTime: "09:00", durationMinutes: 30 }, 4)).toEqual({
      start: at(9),
      end: at(9, 30),
    });
    expect(blockOf({ startTime: "22:30", endTime: "01:00" }, 4)).toEqual({
      start: at(22, 30),
      end: at(1),
    });
    expect(blockOf({ startTime: null, durationMinutes: 30 }, 4)).toBeNull();
  });

  it("turns positions back into clock times", () => {
    expect(minuteToTime(0, 4)).toBe("04:00");
    expect(minuteToTime(at(14), 4)).toBe("14:00");
    expect(minuteToTime(1440, 4)).toBe("04:00");
    expect(minuteToTime(at(1, 30), 4)).toBe("01:30");
  });
});

describe("overlaps: the shorter entry wins", () => {
  it("a short entry inside a long one splits the long one", () => {
    const { pieces, overlaps } = resolveOverlaps([
      { id: "work", start: at(9), end: at(17) },
      { id: "lunch", start: at(13), end: at(14) },
    ]);
    expect(pieces).toEqual([
      { id: "work", start: at(9), end: at(13) },
      { id: "lunch", start: at(13), end: at(14) },
      { id: "work", start: at(14), end: at(17) },
    ]);
    expect(overlaps).toEqual([{ winnerId: "lunch", loserId: "work", start: at(13), end: at(14) }]);
  });

  it("a partial overlap trims the longer entry", () => {
    const { pieces } = resolveOverlaps([
      { id: "gym", start: at(9), end: at(10, 30) },
      { id: "walk", start: at(10), end: at(11) },
    ]);
    expect(pieces).toEqual([
      { id: "gym", start: at(9), end: at(10) },
      { id: "walk", start: at(10), end: at(11) },
    ]);
  });

  it("ranks by the whole entry, not the part shown on this day", () => {
    // A night of 8 h shows only 3.5 h after 4 AM, but a 1 h entry still beats it.
    const { overlaps } = resolveOverlaps([
      { id: "read", start: at(6), end: at(7) },
      { id: "sleep", start: 0, end: at(7, 30), size: 480 },
    ]);
    expect(overlaps[0]).toMatchObject({ winnerId: "read", loserId: "sleep" });
  });

  it("works out what is left of the longer entry", () => {
    expect(overlapRemainder({ start: 0, end: 100 }, { start: 40, end: 60 })).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ]);
    expect(overlapRemainder({ start: 0, end: 100 }, { start: 50, end: 120 })).toEqual([
      { start: 0, end: 50 },
    ]);
    expect(overlapRemainder({ start: 0, end: 100 }, { start: 0, end: 100 })).toEqual([]);
  });
});

describe("gaps", () => {
  it("finds waking time with nothing logged, at least the minimum length", () => {
    const blocks = [
      { start: at(8), end: at(14) },
      { start: at(17), end: at(19) },
      { start: at(19, 30), end: at(21) },
    ];
    expect(findGaps(blocks, { start: at(7, 30), end: at(22, 30) }, 120)).toEqual([
      { start: at(14), end: at(17) },
    ]);
    expect(findGaps(blocks, { start: at(7, 30), end: at(23) }, 30)).toEqual([
      { start: at(7, 30), end: at(8) },
      { start: at(14), end: at(17) },
      { start: at(19), end: at(19, 30) },
      { start: at(21), end: at(23) },
    ]);
  });
});

describe("sleep", () => {
  it("counts bed → wake across midnight", () => {
    expect(sleepMinutes("23:30", "07:30")).toBe(480);
    expect(sleepMinutes("01:00", "07:30")).toBe(390);
  });

  it("splits a night between the two days at the day start", () => {
    const bedTimes = new Map([["2026-11-19", "23:30"]]);
    const wakeTimes = new Map([["2026-11-20", "07:30"]]);
    const night = { dayStartHour: 4, bedTimes, wakeTimes };

    expect(sleepSegments({ ...night, date: "2026-11-19" })).toEqual([
      expect.objectContaining({ id: "sleep-after", start: at(23, 30), end: 1440, minutes: 480 }),
    ]);
    expect(sleepSegments({ ...night, date: "2026-11-20" })).toEqual([
      expect.objectContaining({ id: "sleep-before", start: 0, end: at(7, 30), minutes: 480 }),
    ]);
  });

  it("without a bed time, sleep runs from the day start to the wake time", () => {
    const [seg] = sleepSegments({
      date: "2026-11-20",
      dayStartHour: 4,
      bedTimes: new Map(),
      wakeTimes: new Map([["2026-11-20", "08:00"]]),
    });
    expect(seg).toMatchObject({ start: 0, end: at(8), minutes: null });
  });
});
