"use client";

import { useCallback, useState } from "react";

/** Which phases are expanded on the Habits screen. Remembered on this device only. */
const STORAGE_KEY = "dinik-habits-open-phases";

function readOpen(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(
      Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function saveOpen(open: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...open]));
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
}

/**
 * All phases start collapsed. Safe to read storage in the initial state: the phase list only
 * renders after the (client-side) data has loaded, so the server and first client render match.
 */
export function useOpenPhases() {
  const [open, setOpen] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : readOpen(),
  );

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveOpen(next);
      return next;
    });
  }, []);

  const expand = useCallback((id: string) => {
    setOpen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      saveOpen(next);
      return next;
    });
  }, []);

  return { isOpen: (id: string) => open.has(id), toggle, expand };
}
