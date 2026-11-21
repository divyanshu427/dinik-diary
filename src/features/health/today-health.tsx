"use client";

import { HeartPulse } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Panel } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { useHealthEditor } from "@/hooks/use-health";
import type { IsoDate } from "@/lib/core";
import { PainScale } from "./pain-scale";
import { useHealthModel } from "./use-health-model";

const t = copy.pages.health.today;

/**
 * "Health check-in" on Today: tap 0–10 for each active issue (saved straight away), an
 * optional note, and one general health note for the day. Hidden when nothing is tracked.
 */
export function TodayHealth({ date }: { date: IsoDate }) {
  const { model } = useHealthModel();
  const editor = useHealthEditor();
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!model || model.active.length === 0) return null;

  const run = (work: Promise<unknown>) => {
    setError(null);
    work.catch((e) =>
      setError(copy.pages.health.failed(e instanceof Error ? e.message : String(e))),
    );
  };
  const dayNote = model.dayStatus(date)?.note ?? "";
  const suggestions = date === model.today ? model.suggestions.length : 0;

  return (
    <Panel title={t.title} subtitle={t.subtitle}>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {suggestions > 0 && (
        <Link
          href="/health"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/70"
          data-testid="health-suggestions-link"
        >
          <span className="flex items-center gap-2">
            <HeartPulse aria-hidden className="size-4" />
            {t.suggestions(suggestions)}
          </span>
          <span className="shrink-0 underline-offset-4">{t.open}</span>
        </Link>
      )}

      <ul className="flex flex-col gap-4">
        {model.active.map((issue) => {
          const current = model.checkInsFor(issue.id).find((c) => c.date === date);
          const open = noteOpen === issue.id || !!current?.note;
          return (
            <li key={issue.id} data-check-in={issue.title}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{issue.title}</span>
                {current && (
                  <span className="text-xs text-muted-foreground">
                    {copy.pages.health.scaleWords[current.severity]}
                  </span>
                )}
              </div>
              <PainScale
                label={copy.pages.health.checkIn.level(issue.title)}
                value={current?.severity ?? null}
                onChange={(level) => run(editor.checkIn.mutateAsync([issue.id, date, level]))}
              />
              {open ? (
                <Input
                  key={`${issue.id}-${date}-${current?.note ?? ""}`}
                  aria-label={t.note(issue.title)}
                  defaultValue={current?.note ?? ""}
                  placeholder={copy.pages.health.checkIn.notePlaceholder}
                  disabled={!current}
                  className="mt-2"
                  onBlur={(e) => {
                    const note = e.currentTarget.value;
                    if (current && note.trim() !== current.note)
                      run(editor.checkIn.mutateAsync([issue.id, date, current.severity, note]));
                  }}
                />
              ) : (
                current && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto px-0"
                    onClick={() => setNoteOpen(issue.id)}
                  >
                    {t.addNote}
                  </Button>
                )
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t pt-4">
        <label htmlFor={`day-note-${date}`} className="mb-1.5 block text-sm font-medium">
          {t.dayNote}
        </label>
        <Textarea
          key={`day-note-${date}-${dayNote}`}
          id={`day-note-${date}`}
          rows={2}
          defaultValue={dayNote}
          placeholder={t.dayNotePlaceholder}
          onBlur={(e) => {
            const note = e.currentTarget.value;
            if (note.trim() !== dayNote) run(editor.setDayNote.mutateAsync([date, note]));
          }}
        />
      </div>
    </Panel>
  );
}
