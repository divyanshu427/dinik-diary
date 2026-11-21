import { describe, expect, it } from "vitest";
import type { HabitTarget } from "@/data/schema";
import { scoreEntry } from "./scoring";
import { planTargetChange, targetOn } from "./targets";

const target = (id: string, value: number, from: string, to: string | null): HabitTarget => ({
  id,
  habitId: "steps",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  targetValue: value,
  targetTime: null,
  graceMinutes: 0,
  validFrom: from,
  validTo: to,
});

// Steps target raised from 5,000 to 8,000 on 10 Nov.
const history = [
  target("old", 5000, "2000-01-01", "2026-11-09"),
  target("new", 8000, "2026-11-10", null),
];
const steps = { type: "numeric", direction: "higher_better" } as const;
const sixThousand = { value: 6000, time: null };

describe("target history", () => {
  it("picks the target that applied on each day", () => {
    expect(targetOn(history, "2026-11-09")?.id).toBe("old");
    expect(targetOn(history, "2026-11-10")?.id).toBe("new");
    expect(targetOn(history, "2027-05-01")?.id).toBe("new");
  });

  it("6,000 steps: done on the 9th (target 5,000), 75% on the 11th (target 8,000)", () => {
    const on9th = scoreEntry(steps, targetOn(history, "2026-11-09"), sixThousand, 4);
    const on11th = scoreEntry(steps, targetOn(history, "2026-11-11"), sixThousand, 4);
    expect(on9th).toEqual({ done: true, progress: 100 });
    expect(on11th).toEqual({ done: false, progress: 75 });
  });

  it("falls back to the earliest target for a date before any target", () => {
    const late = [target("a", 1, "2026-06-01", null)];
    expect(targetOn(late, "2026-01-01")?.id).toBe("a");
  });
});

describe("changing a target", () => {
  const values = { targetValue: 10000, targetTime: null, graceMinutes: 0 };

  it("closes the old target the day before and starts a new one", () => {
    expect(planTargetChange("steps", history, values, "2026-11-25")).toEqual({
      kind: "split",
      close: { id: "new", validTo: "2026-11-24" },
      create: { habitId: "steps", ...values, validFrom: "2026-11-25", validTo: null },
    });
  });

  it("changing twice on the same day just updates today's target", () => {
    expect(planTargetChange("steps", history, values, "2026-11-10")).toEqual({
      kind: "update",
      id: "new",
      values,
    });
  });

  it("creates the first target when there is none", () => {
    expect(planTargetChange("steps", [], values, "2026-11-20").kind).toBe("create");
  });
});
