"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import type { Settings } from "@/data/schema";
import { useSettings, useUpdateSettings } from "@/hooks/use-data";

const t = copy.pages.settings.unlock;

/** The phase unlock rule: target %, window length and logged days needed. */
export function UnlockRule() {
  const { data: settings } = useSettings();
  // Lives here, not in the form: the form starts fresh whenever the saved rule changes.
  const [saved, setSaved] = useState(false);
  if (!settings) return null;
  // Remount when the saved values change (after saving, or restoring a backup).
  const key = `${settings.unlockThreshold}-${settings.windowDays}-${settings.minLoggedDays}`;
  return <UnlockRuleForm key={key} settings={settings} saved={saved} setSaved={setSaved} />;
}

function UnlockRuleForm({
  settings,
  saved,
  setSaved,
}: {
  settings: Settings;
  saved: boolean;
  setSaved: (saved: boolean) => void;
}) {
  const update = useUpdateSettings();
  const [threshold, setThreshold] = useState(String(settings.unlockThreshold));
  const [windowDays, setWindowDays] = useState(String(settings.windowDays));
  const [minLogged, setMinLogged] = useState(String(settings.minLoggedDays));
  const [errors, setErrors] = useState<
    Partial<Record<"threshold" | "window" | "minLogged", string>>
  >({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const th = Number(threshold);
    const w = Number(windowDays);
    const m = Number(minLogged);
    const next: typeof errors = {};
    if (!Number.isInteger(th) || th < 50 || th > 100) next.threshold = t.errors.threshold;
    if (!Number.isInteger(w) || w < 7 || w > 28) next.window = t.errors.window;
    if (!Number.isInteger(m) || m < 1 || (Number.isInteger(w) && m > w))
      next.minLogged = t.errors.minLogged;
    setErrors(next);
    if (Object.keys(next).length) return;
    update.mutate(
      { unlockThreshold: th, windowDays: w, minLoggedDays: m },
      { onSuccess: () => setSaved(true) },
    );
  };

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    error: string | undefined,
  ) => (
    <FormField label={label} htmlFor={id} error={error}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
    </FormField>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {field("unlock-threshold", t.threshold, threshold, setThreshold, errors.threshold)}
        {field("unlock-window", t.window, windowDays, setWindowDays, errors.window)}
        {field("unlock-min-logged", t.minLogged, minLogged, setMinLogged, errors.minLogged)}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={update.isPending}>
          {t.save}
        </Button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {saved ? t.saved : ""}
        </p>
      </div>
    </form>
  );
}
