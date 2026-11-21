"use client";

import { useMemo, useState, type FormEvent } from "react";
import { FormField } from "@/components/form-field";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { copy } from "@/copy";
import type { Settings } from "@/data/schema";
import { useSettings, useUpdateSettings } from "@/hooks/use-data";

const t = copy.pages.settings.day;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** A real IANA time zone name, as this browser understands it. */
export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz.trim() !== "";
  } catch {
    return false;
  }
}

/** Asia/Calcutta and Asia/Kolkata are the same zone under two names. */
function sameZone(a: string, b: string): boolean {
  if (!isTimeZone(a) || !isTimeZone(b)) return a === b;
  const canonical = (tz: string) =>
    new Intl.DateTimeFormat("en", { timeZone: tz }).resolvedOptions().timeZone;
  return canonical(a) === canonical(b);
}

/** Day start, week start, time zone and units. */
export function DaySettings() {
  const { data: settings } = useSettings();
  const [saved, setSaved] = useState(false);
  if (!settings) return null;
  const key = `${settings.dayStartHour}-${settings.weekStart}-${settings.timezone}-${settings.units}`;
  return <DayForm key={key} settings={settings} saved={saved} setSaved={setSaved} />;
}

function DayForm({
  settings,
  saved,
  setSaved,
}: {
  settings: Settings;
  saved: boolean;
  setSaved: (saved: boolean) => void;
}) {
  const update = useUpdateSettings();
  const [dayStart, setDayStart] = useState(settings.dayStartHour);
  const [weekStart, setWeekStart] = useState(settings.weekStart);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [units, setUnits] = useState(settings.units);
  const [error, setError] = useState<string | null>(null);

  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [];
    }
  }, []);
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    if (!isTimeZone(timezone)) {
      setError(t.timezoneInvalid);
      return;
    }
    setError(null);
    update.mutate(
      { dayStartHour: dayStart, weekStart, timezone: timezone.trim(), units },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t.dayStart} htmlFor="day-start">
          <NativeSelect
            id="day-start"
            value={String(dayStart)}
            onChange={(e) => setDayStart(Number(e.target.value))}
            className="w-full"
          >
            {HOURS.map((h) => (
              <NativeSelectOption key={h} value={String(h)}>
                {t.hour(h)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">{t.dayStartHint}</p>
        </FormField>
        <FormField label={t.weekStart}>
          <SegmentedControl<Settings["weekStart"]>
            label={t.weekStart}
            options={(["monday", "sunday"] as const).map((value) => ({
              value,
              label: t.weekStarts[value],
            }))}
            value={weekStart}
            onChange={setWeekStart}
          />
        </FormField>
        <FormField label={t.timezone} htmlFor="timezone" error={error ?? undefined}>
          <Input
            id="timezone"
            list="timezones"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder={t.timezoneHint}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? "timezone-error" : undefined}
          />
          <datalist id="timezones">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          {deviceZone && !sameZone(deviceZone, timezone) && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto justify-start px-0"
              onClick={() => setTimezone(deviceZone)}
            >
              {t.useDevice(deviceZone)}
            </Button>
          )}
        </FormField>
        <FormField label={t.units}>
          <SegmentedControl<Settings["units"]>
            label={t.units}
            options={(["metric", "imperial"] as const).map((value) => ({
              value,
              label: t.unitOptions[value],
            }))}
            value={units}
            onChange={setUnits}
          />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">{t.note}</p>
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
