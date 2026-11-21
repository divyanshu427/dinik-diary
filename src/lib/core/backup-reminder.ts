/*
 * The weekly "download a backup" reminder (Build Phase 13). Browser storage can be cleared, so
 * the app reminds me after `reminderDays` without a backup (0 = never).
 */

const DAY_MS = 86_400_000;

export interface BackupReminderInput {
  /** ISO timestamp of the last download, or null for never. */
  lastBackupAt: string | null;
  /** When this device's data started (counts as "no backup since then"). */
  seededAt: string;
  reminderDays: number;
  now: Date;
  /** "Remind me tomorrow": nothing before this ISO time. */
  snoozedUntil?: string | null;
}

export interface BackupReminder {
  due: boolean;
  /** Whole days since the last backup; null when there never was one. */
  daysSince: number | null;
}

export function backupReminder(input: BackupReminderInput): BackupReminder {
  const { lastBackupAt, seededAt, reminderDays, now } = input;
  const daysSince =
    lastBackupAt === null ? null : Math.floor((now.getTime() - Date.parse(lastBackupAt)) / DAY_MS);
  if (reminderDays <= 0) return { due: false, daysSince };
  if (input.snoozedUntil && Date.parse(input.snoozedUntil) > now.getTime()) {
    return { due: false, daysSince };
  }
  const since = Date.parse(lastBackupAt ?? seededAt);
  return { due: now.getTime() - since >= reminderDays * DAY_MS, daysSince };
}
