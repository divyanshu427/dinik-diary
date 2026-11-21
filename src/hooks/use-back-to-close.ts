"use client";

import { useEffect, useRef } from "react";

/**
 * While `open`, the phone's back button / gesture closes the view instead of leaving the page.
 * Adds one history entry when it opens and removes it again when it's closed another way.
 */
export function useBackToClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ dinikSheet: true }, "");
    let popped = false;
    const onPop = () => {
      popped = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!popped && window.history.state?.dinikSheet) window.history.back();
    };
  }, [open]);
}
