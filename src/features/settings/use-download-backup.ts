"use client";

import { backupFileName } from "@/data/backup";
import { useExportBackup, useUpdateSettings } from "@/hooks/use-data";
import { downloadText } from "@/lib/download";

/** Today's date on this device, for the file name. */
function localDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Downloads a full backup and remembers when (for the backup reminder).
 * Shared by Settings and the reminder on Today.
 */
export function useDownloadBackup() {
  const exportBackup = useExportBackup();
  const updateSettings = useUpdateSettings();
  return {
    isPending: exportBackup.isPending,
    download: async (): Promise<string> => {
      const file = await exportBackup.mutateAsync();
      const name = backupFileName(localDate());
      downloadText(name, JSON.stringify(file, null, 2), "application/json");
      await updateSettings.mutateAsync({ lastBackupAt: new Date().toISOString() });
      return name;
    },
  };
}
