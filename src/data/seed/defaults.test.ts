import { describe, expect, it } from "vitest";
import { checkIntegrity } from "../backup";
import {
  categorySchema,
  habitSchema,
  habitTargetSchema,
  phaseSchema,
  settingsSchema,
} from "../schema";
import { buildSeed } from "./defaults";

let n = 0;
const seed = buildSeed({ now: "2026-11-20T08:00:00.000Z", newId: () => `id-${++n}` });

describe("starter data", () => {
  it("has 5 phases, Phase 1 active and the rest locked", () => {
    expect(seed.phases.map((p) => [p.number, p.status])).toEqual([
      [1, "active"],
      [2, "locked"],
      [3, "locked"],
      [4, "locked"],
      [5, "locked"],
    ]);
  });

  it("puts 11 habits in Phase 1 (water goal included), with brush and face wash split into morning and night", () => {
    const phase1 = seed.habits.filter((h) => h.phaseId === seed.phases[0].id);
    expect(phase1).toHaveLength(11);
    expect(phase1.map((h) => h.key)).toEqual(
      expect.arrayContaining([
        "brush_morning",
        "brush_night",
        "skincare_morning",
        "skincare_night",
      ]),
    );
    // Lunch and dinner are activities, not habits.
    expect(seed.habits.find((h) => /lunch|dinner/i.test(h.name))).toBeUndefined();
  });

  it("has the 15 starter categories, with at most 8 distinct chart colours", () => {
    expect(seed.categories).toHaveLength(15);
    const coloured = seed.categories.filter((c) => c.colorToken !== "chart-other");
    expect(new Set(coloured.map((c) => c.colorToken)).size).toBe(coloured.length);
    expect(coloured.length).toBeLessThanOrEqual(8);
  });

  it("gives every habit exactly one target of the right kind", () => {
    for (const h of seed.habits) {
      const targets = seed.habitTargets.filter((t) => t.habitId === h.id);
      expect(targets, h.key).toHaveLength(1);
      const [t] = targets;
      if (h.type === "time") expect(t.targetTime, h.key).toMatch(/^\d\d:\d\d$/);
      if (h.type === "count" || h.type === "duration" || h.type === "numeric") {
        expect(t.targetValue, h.key).toBeGreaterThan(0);
      }
    }
  });

  it("uses default settings: 4 AM day start, Monday weeks, India time, 80% over 14 days", () => {
    expect(seed.settings).toMatchObject({
      dayStartHour: 4,
      weekStart: "monday",
      timezone: "Asia/Kolkata",
      unlockThreshold: 80,
      windowDays: 14,
      minLoggedDays: 10,
    });
  });

  it("gives every habit a part of day, e.g. night brushing at night", () => {
    const byKey = new Map(seed.habits.map((h) => [h.key, h.partOfDay]));
    expect(byKey.get("brush_morning")).toBe("morning");
    expect(byKey.get("brush_night")).toBe("night");
    expect(seed.habits.every((h) => h.partOfDay)).toBe(true);
  });

  it("keeps a theme passed in", () => {
    const s = buildSeed({
      now: "2026-11-20T08:00:00.000Z",
      newId: () => `x-${++n}`,
      theme: { preset: "mono", mode: "dark" },
    });
    expect(s.settings).toMatchObject({ themePreset: "mono", colorMode: "dark" });
  });

  it("is valid against every schema and has no broken references", () => {
    seed.phases.forEach((r) => phaseSchema.parse(r));
    seed.categories.forEach((r) => categorySchema.parse(r));
    seed.habits.forEach((r) => habitSchema.parse(r));
    seed.habitTargets.forEach((r) => habitTargetSchema.parse(r));
    settingsSchema.parse(seed.settings);
    expect(
      checkIntegrity({
        ...seed,
        habitLogs: [],
        dayStatus: [],
        activities: [],
        metrics: [],
        concerns: [],
        concernUpdates: [],
        healthReports: [],
        reportFiles: [],
        labValues: [],
      }),
    ).toEqual([]);
  });
});
