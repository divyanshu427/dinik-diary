"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { getDataStore } from "@/data";
import { buildDemoData } from "@/data/demo";
import { createLocalDataStore } from "@/data/local/local-store";
import { DEMO_DB_NAME, writeProfile } from "@/data/profile";
import { queryKeys } from "@/hooks/query-keys";
import { useProfile } from "@/hooks/use-profile";
import { useToday } from "@/hooks/use-today";
import { parsePreference, THEME_STORAGE_KEY } from "@/theme/preference";

const t = copy.pages.demo;

function currentTheme() {
  try {
    const pref = parsePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
    return { preset: pref.preset, mode: pref.mode };
  } catch {
    return undefined;
  }
}

/** Switch between your own data and the demo profile (a separate database). */
export function DemoSection() {
  const profile = useProfile();
  const today = useToday();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await work();
    } catch (e) {
      setError(t.failed(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const openDemo = () =>
    run(async () => {
      const demo = createLocalDataStore({ dbName: DEMO_DB_NAME });
      await demo.importAll(buildDemoData({ today: today!, theme: currentTheme() }));
      writeProfile("demo");
      // A full reload, so the app opens the demo database from scratch.
      reloadAt("/");
    });

  const rebuild = () =>
    run(async () => {
      await getDataStore().importAll(buildDemoData({ today: today!, theme: currentTheme() }));
      await qc.invalidateQueries({ queryKey: queryKeys.all });
      setMessage(t.rebuilt);
    });

  return (
    <div className="flex flex-col gap-3">
      {profile === "demo" ? (
        <>
          <p className="flex items-start gap-2 text-sm">
            <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            {t.active}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => switchToMyData()}>{t.back}</Button>
            <Button variant="outline" disabled={busy || !today} onClick={rebuild}>
              {busy ? t.rebuilding : t.rebuild}
            </Button>
          </div>
        </>
      ) : (
        <div>
          <Button variant="outline" disabled={busy || !today} onClick={openDemo}>
            <FlaskConical aria-hidden />
            {busy ? t.opening : t.open}
          </Button>
        </div>
      )}
      <div aria-live="polite">
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function switchToMyData() {
  writeProfile("me");
  reloadAt("/settings");
}

/** Full page load (not client navigation): the data store is chosen once per page load. */
function reloadAt(path: string) {
  window.location.href = path;
}
