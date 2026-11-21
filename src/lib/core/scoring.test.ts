import { describe, expect, it } from "vitest";
import { scoreEntry, type ScorableHabit, type ScorableTarget } from "./scoring";

const higher = (type: ScorableHabit["type"]): ScorableHabit => ({
  type,
  direction: "higher_better",
});
const lower: ScorableHabit = { type: "numeric", direction: "lower_better" };
const value = (target: number | null): ScorableTarget => ({
  targetValue: target,
  targetTime: null,
  graceMinutes: 0,
});
const byTime = (time: string, grace = 15): ScorableTarget => ({
  targetValue: null,
  targetTime: time,
  graceMinutes: grace,
});
const v = (n: number | null) => ({ value: n, time: null });
const at = (time: string) => ({ value: null, time });

describe("scoring one habit for one day", () => {
  it("nothing logged = not done, 0%", () => {
    expect(scoreEntry(higher("count"), value(8), null, 4)).toEqual({ done: false, progress: 0 });
  });

  it("yes/no habits are 0% or 100%", () => {
    expect(scoreEntry(higher("boolean"), undefined, v(1), 4)).toEqual({
      done: true,
      progress: 100,
    });
    expect(scoreEntry(higher("boolean"), undefined, v(0), 4)).toEqual({ done: false, progress: 0 });
  });

  it("3 of 8 glasses → not done, 37.5%", () => {
    expect(scoreEntry(higher("count"), value(8), v(3), 4)).toEqual({ done: false, progress: 37.5 });
  });

  it("9 of 8 → done, capped at 100%", () => {
    expect(scoreEntry(higher("count"), value(8), v(9), 4)).toEqual({ done: true, progress: 100 });
  });

  it("minutes and numbers work the same way", () => {
    expect(scoreEntry(higher("duration"), value(30), v(20), 4)).toEqual({
      done: false,
      progress: 66.7,
    });
    expect(scoreEntry(higher("numeric"), value(5000), v(5000), 4)).toEqual({
      done: true,
      progress: 100,
    });
  });

  it("'at most' habits: under the limit is done, over it gets partial credit", () => {
    expect(scoreEntry(lower, value(30), v(20), 4)).toEqual({ done: true, progress: 100 });
    expect(scoreEntry(lower, value(30), v(0), 4)).toEqual({ done: true, progress: 100 });
    expect(scoreEntry(lower, value(30), v(45), 4)).toEqual({ done: false, progress: 66.7 });
    expect(scoreEntry(lower, value(30), v(120), 4)).toEqual({ done: false, progress: 25 });
  });

  describe("time habits (wake up by 7:30, 15 min grace)", () => {
    const wake = higher("time");

    it("on time or early → done", () => {
      expect(scoreEntry(wake, byTime("07:30"), at("07:30"), 4)).toEqual({
        done: true,
        progress: 100,
      });
      expect(scoreEntry(wake, byTime("07:30"), at("06:45"), 4)).toEqual({
        done: true,
        progress: 100,
      });
    });

    it("7:40 is within the grace window → partial (50%)", () => {
      expect(scoreEntry(wake, byTime("07:30"), at("07:40"), 4)).toEqual({
        done: false,
        progress: 50,
      });
    });

    it("8:00 is past the grace window → 0%", () => {
      expect(scoreEntry(wake, byTime("07:30"), at("08:00"), 4)).toEqual({
        done: false,
        progress: 0,
      });
    });

    it("no grace window → any lateness is 0%", () => {
      expect(scoreEntry(wake, byTime("07:30", 0), at("07:31"), 4)).toEqual({
        done: false,
        progress: 0,
      });
    });

    it("bedtime after midnight is late, not early", () => {
      const bed = byTime("23:30");
      expect(scoreEntry(wake, bed, at("23:10"), 4)).toEqual({ done: true, progress: 100 });
      expect(scoreEntry(wake, bed, at("23:40"), 4)).toEqual({ done: false, progress: 50 });
      expect(scoreEntry(wake, bed, at("00:30"), 4)).toEqual({ done: false, progress: 0 });
    });
  });
});
