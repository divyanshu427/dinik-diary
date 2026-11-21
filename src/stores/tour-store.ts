import { create } from "zustand";
import { copy } from "@/copy";

export type TourPage = keyof typeof copy.tour.pages;
export type TourStep = (typeof copy.tour.pages)[TourPage][number];

/** The element a step points at, if it's on the page and showing. */
export function tourTarget(target: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? el : null;
}

interface TourState {
  /** The steps of the running tour (only those whose target is showing), or empty. */
  steps: readonly TourStep[];
  index: number;
  start: (page: TourPage) => void;
  next: () => void;
  back: () => void;
  stop: () => void;
}

/** Which page tour is running and which step it's on. */
export const useTourStore = create<TourState>()((set) => ({
  steps: [],
  index: 0,
  start: (page) => {
    // Skip steps whose part of the page isn't there (e.g. a card that's empty today).
    const steps = copy.tour.pages[page].filter((s) => tourTarget(s.target));
    set({ steps, index: 0 });
  },
  next: () =>
    set((s) => (s.index + 1 < s.steps.length ? { index: s.index + 1 } : { steps: [], index: 0 })),
  back: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  stop: () => set({ steps: [], index: 0 }),
}));
