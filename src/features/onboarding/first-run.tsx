"use client";

import { Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { brand } from "@/brand/brand.config";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { startListDetail, phaseLabel } from "@/features/habits/format";
import { useHabitEditor } from "@/hooks/use-habit-editor";
import { useHabits, useHabitTargets, usePhases, useSettings } from "@/hooks/use-data";
import { targetOn } from "@/lib/core";
import { cn } from "@/lib/utils";
import { tourTarget, useTourStore } from "@/stores/tour-store";

const t = copy.pages.start;
/** Ticked to begin with: the easy wins of the starter Phase 1. */
const SUGGESTED = ["wake_up", "morning_water", "brush_morning", "bedtime"];

/**
 * The very first open: "Which habits do you want to start with?" for Phase 1, then an offer
 * of the Today tour. Shown until it's answered (settings.firstRunDone).
 */
export function FirstRun() {
  const settings = useSettings();
  const phases = usePhases();
  const habits = useHabits();
  const targets = useHabitTargets();
  const editor = useHabitEditor();
  const router = useRouter();
  const pathname = usePathname();
  const startTour = useTourStore((s) => s.start);
  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);

  const first = useMemo(
    () => [...(phases.data ?? [])].sort((a, b) => a.number - b.number)[0],
    [phases.data],
  );
  const list = useMemo(
    () =>
      (habits.data ?? [])
        .filter((h) => first && h.phaseId === first.id && !h.archived)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [habits.data, first],
  );

  const asked = settings.data?.firstRunDone === false;
  if ((!asked && step === 1) || !editor.today || !first || list.length === 0) return null;

  const chosen = picked ?? new Set(list.filter((h) => SUGGESTED.includes(h.key)).map((h) => h.id));
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const finish = async (which: string[] | "all") => {
    setSaving(true);
    await editor.completeFirstRun.mutateAsync([which]);
    setSaving(false);
    setStep(2);
  };
  const tour = () => {
    setStep(1);
    if (pathname !== "/") router.push("/");
    // Start once Today is on screen.
    let tries = 0;
    const wait = () => {
      if (tourTarget("today-summary")) startTour("today");
      else if (tries++ < 40) setTimeout(wait, 100);
    };
    wait();
  };
  const today = editor.today;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
      className="fixed inset-0 z-[65] flex flex-col overflow-y-auto bg-background"
      data-testid="first-run"
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-heading text-sm font-bold text-primary-foreground">
              {brand.monogram}
            </span>
            <span className="font-heading text-lg font-semibold">{brand.name}</span>
          </span>
          <span className="text-sm text-muted-foreground">{t.firstStep(step, 2)}</span>
        </div>

        {step === 1 ? (
          <>
            <h1 id="first-run-title" className="mt-6 text-3xl font-bold tracking-tight">
              {t.firstTitle}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t.firstHint}</p>
            <div className="mt-4 flex items-center justify-between gap-2 text-sm">
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                {t.picked(chosen.size, list.length, 3, 5)}
              </span>
              <span className="text-muted-foreground">{phaseLabel(first)}</span>
            </div>
            <ul className="mt-3 divide-y overflow-hidden rounded-2xl border bg-card">
              {list.map((h) => {
                const on = chosen.has(h.id);
                const target = targetOn(
                  (targets.data ?? []).filter((x) => x.habitId === h.id),
                  today,
                );
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(h.id)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:bg-muted"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {on && <Check className="size-4" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 text-base">{h.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {startListDetail(h, target)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-background pt-4">
              <Button
                className="h-12 rounded-xl text-base"
                disabled={saving || chosen.size === 0}
                onClick={() => finish(list.filter((h) => chosen.has(h.id)).map((h) => h.id))}
              >
                {t.firstSubmit(chosen.size)}
              </Button>
              <Button variant="ghost" disabled={saving} onClick={() => finish("all")}>
                {t.firstAll(list.length)}
              </Button>
            </div>
          </>
        ) : (
          <div className="my-auto flex flex-col gap-4 py-10 text-center">
            <h1 id="first-run-title" className="text-3xl font-bold tracking-tight">
              {t.tourTitle}
            </h1>
            <p className="text-muted-foreground">{t.tourHint}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button className="h-12 rounded-xl text-base" onClick={tour}>
                {t.tourYes}
              </Button>
              <Button variant="ghost" onClick={() => setStep(1)}>
                {t.tourNo}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
