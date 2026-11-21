"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Whether a CSS media query matches. False during server rendering. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Laptop and up (Tailwind `xl`, 1280 px): side panels sit beside the main column. */
export const WIDE_QUERY = "(min-width: 1280px)";
