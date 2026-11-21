"use client";

import { useSyncExternalStore } from "react";
import { readProfile, type Profile } from "@/data/profile";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** Which data the app shows: your own ("me") or the demo profile. "me" during server rendering. */
export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, readProfile, () => "me" as const);
}
