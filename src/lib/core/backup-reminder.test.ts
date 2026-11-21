import { describe, expect, it } from "vitest";
import { backupReminder } from "./backup-reminder";

const now = new Date("2026-11-21T10:00:00.000Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe("backup reminder", () => {
  it("is due 7 days after the last backup (or after the data started, if never)", () => {
    const base = { seededAt: daysAgo(30), reminderDays: 7, now };
    expect(backupReminder({ ...base, lastBackupAt: daysAgo(6) })).toEqual({
      due: false,
      daysSince: 6,
    });
    expect(backupReminder({ ...base, lastBackupAt: daysAgo(7) })).toEqual({
      due: true,
      daysSince: 7,
    });
    expect(backupReminder({ ...base, lastBackupAt: null })).toEqual({ due: true, daysSince: null });
    expect(backupReminder({ ...base, seededAt: daysAgo(2), lastBackupAt: null }).due).toBe(false);
  });

  it("can be snoozed, or switched off with 0", () => {
    const base = { seededAt: daysAgo(30), lastBackupAt: daysAgo(10), now };
    expect(backupReminder({ ...base, reminderDays: 0 }).due).toBe(false);
    expect(backupReminder({ ...base, reminderDays: 7, snoozedUntil: daysAgo(-1) }).due).toBe(false);
    expect(backupReminder({ ...base, reminderDays: 7, snoozedUntil: daysAgo(1) }).due).toBe(true);
  });
});
