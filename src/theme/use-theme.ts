"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCE,
  parsePreference,
  resolveMode,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./preference";
import { PRESETS } from "./presets";
import type { ResolvedMode, ThemeMode } from "./tokens";

/*
 * A tiny external store for the theme preference.
 * The inline <head> script applies the saved theme before paint; this store keeps React
 * in sync with it and with changes from other tabs or the OS dark-mode setting.
 */

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();
let cached: ThemePreference | null = null;

function readStorage(): ThemePreference {
  try {
    return parsePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

/** True when this device has a saved theme choice (false on a new device or after clearing data). */
export function hasStoredPreference(): boolean {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function getPreference(): ThemePreference {
  if (!cached) cached = readStorage();
  return cached;
}

function getResolvedMode(): ResolvedMode {
  return document.documentElement.getAttribute("data-mode") === "dark" ? "dark" : "light";
}

function applyToDocument(pref: ThemePreference) {
  const root = document.documentElement;
  root.setAttribute("data-theme", pref.preset);
  root.setAttribute("data-mode", resolveMode(pref.mode, window.matchMedia(DARK_QUERY).matches));
}

function emit() {
  listeners.forEach((l) => l());
}

function setPreference(next: ThemePreference) {
  cached = next;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): the choice still applies for this visit.
  }
  applyToDocument(next);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    window.matchMedia(DARK_QUERY).addEventListener("change", onSystemChange);
    // The device's light/dark setting may have changed while the page was still loading
    // (before anyone listened): catch up now. React re-reads the snapshot after subscribing.
    const pref = getPreference();
    if (pref.mode === "system") applyToDocument(pref);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
      window.matchMedia(DARK_QUERY).removeEventListener("change", onSystemChange);
    }
  };
}

function onStorage(event: StorageEvent) {
  if (event.key !== THEME_STORAGE_KEY) return;
  cached = readStorage();
  applyToDocument(cached);
  emit();
}

function onSystemChange() {
  const pref = getPreference();
  if (pref.mode === "system") {
    applyToDocument(pref);
    emit();
  }
}

const getServerPreference = () => DEFAULT_PREFERENCE;
const getServerResolvedMode = (): ResolvedMode => "light";

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, getPreference, getServerPreference);
  const resolvedMode = useSyncExternalStore(subscribe, getResolvedMode, getServerResolvedMode);

  const setPreset = useCallback(
    (preset: string) => setPreference({ ...getPreference(), preset }),
    [],
  );
  const setMode = useCallback((mode: ThemeMode) => setPreference({ ...getPreference(), mode }), []);

  return {
    preset: preference.preset,
    mode: preference.mode,
    resolvedMode,
    presets: PRESETS,
    setPreset,
    setMode,
  };
}
