"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Settings } from "@/data/schema";
import { SyncRunner } from "@/features/sync/sync-runner";
import { useSettings, useUpdateSettings } from "@/hooks/use-data";
import { getPreset } from "@/theme/presets";
import { hasStoredPreference, useTheme } from "@/theme/use-theme";

/** Gives every screen access to the data hooks (TanStack Query). */
export function DataProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Local data is quick to read; refetch when coming back to the tab (another tab may have changed it).
            staleTime: 30_000,
            retry: false,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <SyncRunner />
      {children}
    </QueryClientProvider>
  );
}

/** Applies the theme stored in settings to the page (used on new devices and after restoring a backup). */
export function useApplyThemeFromSettings() {
  const { setPreset, setMode } = useTheme();
  return useCallback(
    (settings: Pick<Settings, "themePreset" | "colorMode">) => {
      // Ignore a preset this version doesn't have (e.g. from a newer backup).
      if (getPreset(settings.themePreset)) setPreset(settings.themePreset);
      setMode(settings.colorMode);
    },
    [setPreset, setMode],
  );
}

/**
 * Keeps the theme in two places in step, once per page load:
 * - localStorage: read before the first paint, so there's never a flash of the wrong theme;
 * - settings in the database: travels with backups.
 *
 * Rule: the latest choice made on this device wins. If this device has a saved choice, the
 * database is updated to match it (a save can be lost if you leave the page mid-write).
 * If it has none (new device, cleared storage), the database's theme is applied.
 * Restoring a backup applies the backup's theme explicitly (see BackupSection).
 */
function ThemeSync() {
  const { data: settings } = useSettings();
  const { preset, mode } = useTheme();
  const { mutate: saveSettings } = useUpdateSettings();
  const applyFromSettings = useApplyThemeFromSettings();
  const done = useRef(false);

  useEffect(() => {
    if (!settings || done.current) return;
    done.current = true;
    if (!hasStoredPreference()) {
      applyFromSettings(settings);
    } else if (settings.themePreset !== preset || settings.colorMode !== mode) {
      saveSettings({ themePreset: preset, colorMode: mode });
    }
  }, [settings, preset, mode, saveSettings, applyFromSettings]);

  return null;
}
