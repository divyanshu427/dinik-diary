import { describe, expect, it } from "vitest";
import type { HabitSchedule } from "@/data/schema";
import { dueRole } from "./schedule";

describe("which days a habit is due", () => {
  it("daily habits are due every day", () => {
    expect(dueRole({ kind: "daily" }, "2026-11-20")).toBe("due");
  });

  it("weekday habits are due only on those days", () => {
    const sundays: HabitSchedule = { kind: "weekdays", days: [6] };
    expect(dueRole(sundays, "2026-11-22")).toBe("due"); // Sunday
    expect(dueRole(sundays, "2026-11-20")).toBe("not-due"); // Friday
  });

  it("every-N-days habits are due on the anchor and every N days, before or after it", () => {
    const every10: HabitSchedule = { kind: "everyNDays", every: 10, anchor: "2026-11-01" };
    expect(dueRole(every10, "2026-11-01")).toBe("due");
    expect(dueRole(every10, "2026-11-11")).toBe("due");
    expect(dueRole(every10, "2026-11-12")).toBe("not-due");
    expect(dueRole(every10, "2026-10-22")).toBe("due");
  });

  it("N-times-a-week habits are flexible every day", () => {
    expect(dueRole({ kind: "timesPerWeek", times: 3 }, "2026-11-20")).toBe("flexible");
  });
});
