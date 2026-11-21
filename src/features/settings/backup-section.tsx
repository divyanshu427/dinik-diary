"use client";

import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApplyThemeFromSettings } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { parseBackup, type BackupFile } from "@/data/backup";
import { useImportBackup, useResetData, useSettings, useUpdateSettings } from "@/hooks/use-data";
import { useDownloadBackup } from "./use-download-backup";

const t = copy.pages.backup;

type Status =
  { kind: "ok"; text: string } | { kind: "error"; text: string; details?: string[] } | null;

/** Download a backup, restore from a file, or reset to the starter data. */
export function BackupSection() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const backup = useDownloadBackup();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const importBackup = useImportBackup();
  const reset = useResetData();
  const applyThemeFromSettings = useApplyThemeFromSettings();
  const busy = backup.isPending || importBackup.isPending || reset.isPending;

  const fail = (e: unknown) =>
    setStatus({ kind: "error", text: t.failed(e instanceof Error ? e.message : String(e)) });

  function onExport() {
    setStatus(null);
    backup
      .download()
      .then((name) => setStatus({ kind: "ok", text: t.exported(name) }))
      .catch(fail);
  }

  async function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setStatus(null);
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setStatus({ kind: "error", text: t.importInvalid, details: result.errors });
      return;
    }
    setPending(result.file);
  }

  function onConfirmImport() {
    if (!pending) return;
    const restored = pending;
    importBackup.mutate(restored, {
      onSuccess: () => {
        applyThemeFromSettings(restored.data.settings);
        setStatus({ kind: "ok", text: t.imported });
      },
      onError: fail,
      onSettled: () => setPending(null),
    });
  }

  function onConfirmReset() {
    reset.mutate(undefined, {
      onSuccess: () => setStatus({ kind: "ok", text: t.resetDone }),
      onError: fail,
      onSettled: () => setConfirmReset(false),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onExport} disabled={busy}>
          <Download aria-hidden />
          {t.exportButton}
        </Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
          <Upload aria-hidden />
          {t.importButton}
        </Button>
        <Button variant="destructive" onClick={() => setConfirmReset(true)} disabled={busy}>
          <RotateCcw aria-hidden />
          {t.resetButton}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label={t.importButton}
          data-testid="backup-file-input"
          onChange={onFileChosen}
        />
      </div>

      {settings && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <p className="text-muted-foreground" data-testid="last-backup">
            {settings.lastBackupAt
              ? t.lastBackup(lastBackupText(settings.lastBackupAt))
              : t.neverBackedUp}
          </p>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">{t.remindEvery}</span>
            <NativeSelect
              size="sm"
              value={String(settings.backupReminderDays)}
              onChange={(e) =>
                updateSettings.mutate({ backupReminderDays: Number(e.target.value) })
              }
            >
              {REMINDER_DAYS.map((d) => (
                <NativeSelectOption key={d} value={String(d)}>
                  {t.reminderOption(d)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        </div>
      )}

      <div aria-live="polite">
        {status?.kind === "ok" && (
          <p role="status" className="text-sm font-medium text-success">
            {status.text}
          </p>
        )}
        {status?.kind === "error" && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
          >
            <p className="font-medium">{status.text}</p>
            {status.details && (
              <ul className="mt-1 list-disc pl-5">
                {status.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.importConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending &&
                t.importConfirmBody(
                  new Date(pending.exportedAt).toLocaleString(),
                  pending.data.habits.length,
                  pending.data.habitLogs.length,
                  pending.data.activities.length,
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmImport} disabled={importBackup.isPending}>
              {t.importConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.resetConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.resetConfirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={onConfirmReset}
              disabled={reset.isPending}
            >
              {t.resetConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Today's date on this device as YYYY-MM-DD (for the file name). */

const REMINDER_DAYS = [0, 3, 7, 14, 30] as const;

/** "today", "yesterday", "5 days ago" */
function lastBackupText(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return t.daysAgo(days);
}
