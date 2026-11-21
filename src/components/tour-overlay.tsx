"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";
import { tourTarget, useTourStore } from "@/stores/tour-store";

const t = copy.tour;
/** Space between the spotlight and the part of the page it frames. */
const PAD = 6;
/** Gap between the spotlight and the card. */
const GAP = 14;
/** Rough height of the card, to decide whether it fits below or above. */
const CARD_H = 230;
const CARD_W = 380;

interface Frame {
  top: number;
  left: number;
  width: number;
  height: number;
  vw: number;
  vh: number;
}

/**
 * The spotlight tour: darkens the page, frames one part of it, and explains it in a card with
 * "Step 2 of 5", Back, Skip tour and Next. Started from the ⓘ button on a page.
 */
export function TourOverlay() {
  const { steps, index, next, back, stop } = useTourStore();
  const step = steps[index];
  const pathname = usePathname();
  const [frame, setFrame] = useState<Frame | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Leaving the page ends the tour.
  useEffect(() => {
    stop();
  }, [pathname, stop]);

  // Bring the step's part of the page into view, then keep the spotlight on it.
  useEffect(() => {
    if (!step) return;
    const el = tourTarget(step.target);
    if (!el) {
      next();
      return;
    }
    const box = el.getBoundingClientRect();
    const tall = box.height > window.innerHeight * 0.5;
    // Tall parts (a long checklist) scroll to their top; short ones to the middle.
    window.scrollTo({
      top: tall
        ? window.scrollY + box.top - 90
        : window.scrollY + box.top - (window.innerHeight - box.height) / 2 + CARD_H / 3,
      behavior: "instant",
    });

    const measure = () => {
      const b = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // A tall part is framed only at the top, so the card still fits under it.
      const height = Math.min(b.height, vh * 0.42);
      setFrame({
        top: b.top - PAD,
        left: Math.max(4, b.left - PAD),
        width: Math.min(b.width + PAD * 2, window.innerWidth - 8),
        height: height + PAD * 2,
        vw: window.innerWidth,
        vh,
      });
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [step, next]);

  // Keyboard: Esc ends the tour, arrows move between steps; the page can't scroll meanwhile.
  useEffect(() => {
    if (!step) return;
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = before;
    };
  }, [step, next, back, stop]);

  if (!step || !frame) return null;

  const last = index === steps.length - 1;
  const cardW = Math.min(CARD_W, frame.vw - 32);
  const cardLeft = Math.min(Math.max(16, frame.left), frame.vw - cardW - 16);
  const spaceBelow = frame.vh - (frame.top + frame.height) - GAP;
  const placement = spaceBelow >= CARD_H ? "below" : frame.top - GAP >= CARD_H ? "above" : "bottom";
  const arrowLeft = Math.min(Math.max(frame.left + frame.width / 2 - cardLeft - 8, 20), cardW - 36);

  return (
    <div className="fixed inset-0 z-[70]" data-testid="tour">
      {/* Catches taps on the page while the tour is showing. */}
      <div className="absolute inset-0" aria-hidden />
      {/* The spotlight: a clear hole, with everything around it dimmed. */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-2xl shadow-[0_0_0_200vmax_color-mix(in_srgb,var(--foreground)_55%,transparent)] transition-all duration-200"
        style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-body`}
        className={cn(
          "absolute rounded-2xl bg-popover p-5 text-popover-foreground shadow-xl ring-1 ring-foreground/10",
        )}
        style={{
          left: cardLeft,
          width: cardW,
          ...(placement === "below"
            ? { top: frame.top + frame.height + GAP }
            : placement === "above"
              ? { bottom: frame.vh - frame.top + GAP }
              : { bottom: 16 }),
        }}
      >
        {placement !== "bottom" && (
          <span
            aria-hidden
            className={cn(
              "absolute size-4 rotate-45 bg-popover",
              placement === "below" ? "-top-2" : "-bottom-2",
            )}
            style={{ left: arrowLeft }}
          />
        )}
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          {t.stepOf(index + 1, steps.length)}
        </p>
        <h2 id={titleId} className="mt-1.5 font-heading text-xl font-semibold">
          {step.title}
        </h2>
        <p id={`${titleId}-body`} className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        {/* Long tours: when the dots and buttons don't fit on one line, the buttons go under. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3">
          <span aria-hidden className="flex flex-1 items-center gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.target}
                className={cn(
                  "h-1.5 shrink-0 rounded-full transition-all",
                  i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!last && (
              <Button variant="ghost" onClick={stop}>
                {t.skip}
              </Button>
            )}
            {index > 0 && (
              <Button variant="outline" onClick={back}>
                {t.back}
              </Button>
            )}
            <Button ref={nextRef} onClick={last ? stop : next} className="min-w-20">
              {last ? t.done : t.next}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
