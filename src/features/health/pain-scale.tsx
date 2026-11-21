"use client";

import { useRef, type KeyboardEvent } from "react";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";

const LEVELS = Array.from({ length: 11 }, (_, i) => i);
const words = copy.pages.health.scaleWords;

/**
 * 0–10 as a row of buttons (a radio group: arrow keys move). Nothing is selected until the
 * first check-in; then the first button can still be reached with Tab.
 */
export function PainScale({
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusIndex = value ?? 0;

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = Math.min(10, Math.max(0, index + step));
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid grid-cols-11 gap-1", disabled && "opacity-60", className)}
    >
      {LEVELS.map((n) => {
        const selected = n === value;
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[n] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${n} – ${words[n]}`}
            title={words[n]}
            tabIndex={n === focusIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(n)}
            onKeyDown={(e) => onKeyDown(e, n)}
            className={cn(
              "h-8 min-w-0 rounded-md border text-xs font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? n >= 8
                  ? "border-destructive bg-destructive/15 font-semibold text-destructive"
                  : "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
