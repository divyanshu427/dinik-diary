"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { addDays, type IsoDate } from "@/lib/core";

const t = copy.pages.today.nav;

/** [‹] [calendar] [›] in one pill. The calendar opens the phone's own date picker. */
export function DateNav({
  date,
  today,
  onChange,
}: {
  date: IsoDate;
  today: IsoDate;
  /** Any day up to today. */
  onChange: (date: IsoDate) => void;
}) {
  return (
    <div className="flex items-center rounded-xl border bg-card p-0.5 shadow-xs">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.previous}
        onClick={() => onChange(addDays(date, -1))}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-lg border-x has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
        <CalendarDays aria-hidden className="size-4" />
        <input
          type="date"
          aria-label={t.pick}
          value={date}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // Older browsers open the picker on their own.
            }
          }}
          className="absolute inset-0 size-full min-w-0 cursor-pointer appearance-none opacity-0"
        />
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.next}
        disabled={date >= today}
        onClick={() => onChange(addDays(date, 1))}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
