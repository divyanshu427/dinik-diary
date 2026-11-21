"use client";

import { DatabaseBackup } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { useSettings } from "@/hooks/use-data";
import { useProfile } from "@/hooks/use-profile";
import { useNow } from "@/hooks/use-today";
import { backupReminder } from "@/lib/core";
import { useDownloadBackup } from "./use-download-backup";

const t = copy.pages.backup.reminder;
const SNOOZE_KEY = "dinik-diary:backup-snooze";

function readSnooze(): string | null {
  try {
    return window.localStorage.getItem(SNOOZE_KEY);
  } catch {
    return null;
  }
}
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/** "Download a backup" on Today, after the chosen number of days without one. */
export function BackupReminder() {
  const { data: settings } = useSettings();
  const profile = useProfile();
  const now = useNow();
  const backup = useDownloadBackup();
  const stored = useSyncExternalStore(subscribe, readSnooze, () => null);
  const [snoozed, setSnoozed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p
        role="status"
        className="rounded-xl border border-success/40 bg-card px-4 py-3 text-sm text-success"
      >
        {t.done(done)}
      </p>
    );
  }
  if (!settings || !now || profile === "demo") return null;

  const reminder = backupReminder({
    lastBackupAt: settings.lastBackupAt,
    seededAt: settings.seededAt,
    reminderDays: settings.backupReminderDays,
    now,
    snoozedUntil: snoozed ?? stored,
  });
  if (!reminder.due) return null;

  const later = () => {
    const until = new Date(now.getTime() + 86_400_000).toISOString();
    try {
      window.localStorage.setItem(SNOOZE_KEY, until);
    } catch {
      // Storage blocked: it's hidden for this visit only.
    }
    setSnoozed(until);
  };

  return (
    <div
      role="status"
      data-testid="backup-reminder"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-card px-4 py-3"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <DatabaseBackup aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <div>
          <p className="font-medium">{t.title(reminder.daysSince)}</p>
          <p className="text-sm text-muted-foreground">{t.body}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={backup.isPending}
          onClick={() =>
            backup
              .download()
              .then(setDone)
              .catch((e) =>
                setError(copy.pages.backup.failed(e instanceof Error ? e.message : String(e))),
              )
          }
        >
          {t.download}
        </Button>
        <Button size="sm" variant="ghost" onClick={later}>
          {t.later}
        </Button>
      </div>
    </div>
  );
}
