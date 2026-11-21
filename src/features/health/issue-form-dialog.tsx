"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { FormField } from "@/components/form-field";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import type { HealthIssueDraft } from "@/data/health-ops";
import type { HealthKind } from "@/data/schema";
import { habitRoles, profileFor, type AdvisorHabit } from "@/lib/core";
import { PainScale } from "./pain-scale";

const h = copy.pages.health;
const f = h.form;
const KINDS = (["pain", "symptom", "concern"] as const).map((value) => ({
  value,
  label: h.kinds[value],
}));
const KNOWN = Object.values(h.library).map((x) => x.label);

interface IssueFormDialogProps {
  mode: "create" | "edit";
  initial: HealthIssueDraft;
  /** Habits on the checklist (the app picks which matter; "More details" can correct it). */
  habits: readonly AdvisorHabit[];
  onSubmit: (draft: HealthIssueDraft) => Promise<unknown>;
  onClose: () => void;
}

/**
 * Add or edit a health issue. I only say what's going on and how bad it is; the app works out
 * the rest and shows what it understood. "More details" is there to correct it.
 */
export function IssueFormDialog({
  mode,
  initial,
  habits,
  onSubmit,
  onClose,
}: IssueFormDialogProps) {
  const [v, setV] = useState(initial);
  const [kindTouched, setKindTouched] = useState(mode === "edit");
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof HealthIssueDraft>(key: K, value: HealthIssueDraft[K]) =>
    setV((old) => ({ ...old, [key]: value }));

  const setTitle = (title: string) =>
    setV((old) => ({
      ...old,
      title,
      // The kind follows the name until I pick one myself.
      kind: kindTouched ? old.kind : (profileFor(title)?.kind ?? "symptom"),
    }));

  const profile = profileFor(v.title);
  const roles = useMemo(
    () =>
      habitRoles(
        {
          id: "draft",
          title: v.title,
          kind: v.kind,
          status: "active",
          helpsWith: v.helpsWith,
          linkedHabitIds: v.linkedHabitIds,
          strainHabitIds: v.strainHabitIds,
          adjustments: [],
          dismissed: [],
          checkIns: [],
        },
        habits,
      ),
    [v.title, v.kind, v.helpsWith, v.linkedHabitIds, v.strainHabitIds, habits],
  );
  const named = (role: "strain" | "helps") =>
    habits
      .filter((x) => {
        const r = roles.get(x.id)?.role;
        return role === "strain" ? r === "strain" : r === "helps" || r === "raise";
      })
      .map((x) => x.name);

  const toggle = (key: "linkedHabitIds" | "strainHabitIds", id: string) => {
    const other = key === "linkedHabitIds" ? "strainHabitIds" : "linkedHabitIds";
    setV((old) => ({
      ...old,
      [key]: old[key].includes(id) ? old[key].filter((x) => x !== id) : [...old[key], id],
      [other]: old[other].filter((x) => x !== id),
    }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.title.trim()) {
      setTitleError(f.titleRequired);
      return;
    }
    setTitleError(null);
    setSaving(true);
    setError(null);
    try {
      await onSubmit(v);
      onClose();
    } catch (err) {
      setError(h.failed(err instanceof Error ? err.message : String(err)));
      setSaving(false);
    }
  };

  const habitList = (key: "linkedHabitIds" | "strainHabitIds", testId: string) =>
    habits.length === 0 ? (
      <p className="text-sm text-muted-foreground">{f.none}</p>
    ) : (
      <ul
        className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2"
        data-testid={testId}
      >
        {habits.map((x) => (
          <li key={x.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted">
              <input
                type="checkbox"
                checked={v[key].includes(x.id)}
                onChange={() => toggle(key, x.id)}
                className="size-4 accent-primary"
              />
              <span className="min-w-0 truncate">{x.name}</span>
            </label>
          </li>
        ))}
      </ul>
    );

  const strainNames = named("strain");
  const helpNames = named("helps");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? f.addTitle : f.editTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField label={f.title} htmlFor="issue-title" error={titleError ?? undefined}>
            <Input
              id="issue-title"
              value={v.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={f.titlePlaceholder}
              list="issue-known"
              autoComplete="off"
              aria-invalid={!!titleError}
              aria-describedby={titleError ? "issue-title-error" : undefined}
            />
            <datalist id="issue-known">
              {KNOWN.map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>
          </FormField>

          <FormField label={f.severity}>
            <PainScale
              large
              label={f.severity}
              value={v.severity}
              onChange={(n) => set("severity", n)}
            />
          </FormField>

          {mode === "create" && (
            <FormField label={f.note} htmlFor="issue-note">
              <Textarea
                id="issue-note"
                rows={2}
                value={v.note ?? ""}
                onChange={(e) => set("note", e.target.value)}
                placeholder={f.notePlaceholder}
              />
            </FormField>
          )}

          {v.title.trim() && (
            <div
              className="rounded-xl border border-primary/30 bg-accent px-3 py-2.5 text-sm text-accent-foreground"
              data-testid="understood"
              aria-live="polite"
            >
              <p className="flex items-center gap-2 font-medium">
                <Sparkles aria-hidden className="size-4" />
                {h.understood.title}
              </p>
              <p className="mt-1">
                {profile
                  ? h.understood.known(h.library[profile.id]?.label ?? v.title)
                  : h.understood.unknown}
              </p>
              {(profile || strainNames.length > 0 || helpNames.length > 0) && (
                <dl className="mt-1.5 grid gap-1">
                  <div>
                    <dt className="inline font-medium">{h.understood.strain} </dt>
                    <dd className="inline">{strainNames.join(", ") || h.understood.none}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">{h.understood.helps} </dt>
                    <dd className="inline">{helpNames.join(", ") || h.understood.none}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}

          <details className="group rounded-xl border px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden
                className="size-4 transition-transform group-open:rotate-90"
              />
              {f.moreDetails}
            </summary>
            <p className="mt-1 text-xs text-muted-foreground">{f.moreDetailsHint}</p>
            <div className="mt-4 grid gap-4">
              <FormField label={f.kind}>
                <SegmentedControl<HealthKind>
                  label={f.kind}
                  options={KINDS}
                  value={v.kind}
                  onChange={(k) => {
                    setKindTouched(true);
                    set("kind", k);
                  }}
                  className="flex w-full [&>button]:flex-1 [&>button]:px-2"
                />
                <p className="text-xs text-muted-foreground">{h.kindHints[v.kind]}</p>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={f.bodyArea} htmlFor="issue-area">
                  <Input
                    id="issue-area"
                    value={v.bodyArea}
                    onChange={(e) => set("bodyArea", e.target.value)}
                    placeholder={f.bodyAreaPlaceholder}
                    autoComplete="off"
                  />
                </FormField>
                <FormField label={f.startedAt} htmlFor="issue-since">
                  <Input
                    id="issue-since"
                    type="date"
                    value={v.startedAt}
                    onChange={(e) => e.target.value && set("startedAt", e.target.value)}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={f.worseWith} htmlFor="issue-worse">
                  <Input
                    id="issue-worse"
                    value={v.worseWith}
                    onChange={(e) => set("worseWith", e.target.value)}
                    placeholder={f.worseWithPlaceholder}
                    autoComplete="off"
                  />
                </FormField>
                <FormField label={f.helpsWith} htmlFor="issue-helps">
                  <Input
                    id="issue-helps"
                    value={v.helpsWith}
                    onChange={(e) => set("helpsWith", e.target.value)}
                    placeholder={f.helpsWithPlaceholder}
                    autoComplete="off"
                  />
                </FormField>
              </div>
              <FormField label={f.strain}>
                <p className="-mt-1 text-xs text-muted-foreground">{f.strainHint}</p>
                {habitList("strainHabitIds", "strain-habits")}
              </FormField>
              <FormField label={f.helping}>
                {habitList("linkedHabitIds", "helping-habits")}
              </FormField>
              <FormField label={f.tried} htmlFor="issue-tried">
                <Textarea
                  id="issue-tried"
                  rows={2}
                  value={v.triedSoFar}
                  onChange={(e) => set("triedSoFar", e.target.value)}
                />
              </FormField>
              <FormField label={f.notes} htmlFor="issue-notes">
                <Textarea
                  id="issue-notes"
                  rows={2}
                  value={v.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </FormField>
            </div>
          </details>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {f.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {mode === "create" ? f.create : f.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
