import { brand } from "@/brand/brand.config";
import { PRESET_IDS } from "./presets";
import type { ResolvedMode, ThemeMode } from "./tokens";

/**
 * The user's theme choice. Stored in localStorage for now; moves to the settings
 * table in Build Phase 3.
 */
export interface ThemePreference {
  preset: string;
  mode: ThemeMode;
}

export const THEME_STORAGE_KEY = "dinik-theme";

export const DEFAULT_PREFERENCE: ThemePreference = {
  preset: brand.defaultTheme,
  mode: brand.defaultMode,
};

const MODES: readonly ThemeMode[] = ["light", "dark", "system"];

/** Turns whatever is in storage into a valid preference (falls back to defaults). */
export function parsePreference(raw: string | null | undefined): ThemePreference {
  if (!raw) return DEFAULT_PREFERENCE;
  try {
    const value = JSON.parse(raw) as Partial<ThemePreference>;
    return {
      preset:
        typeof value.preset === "string" && PRESET_IDS.includes(value.preset)
          ? value.preset
          : DEFAULT_PREFERENCE.preset,
      mode: MODES.includes(value.mode as ThemeMode)
        ? (value.mode as ThemeMode)
        : DEFAULT_PREFERENCE.mode,
    };
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function resolveMode(mode: ThemeMode, systemPrefersDark: boolean): ResolvedMode {
  if (mode === "system") return systemPrefersDark ? "dark" : "light";
  return mode;
}

/**
 * Inline script for <head>. Runs before the first paint so the page never flashes the
 * wrong theme. Keep it small and dependency-free: it is serialised as a string.
 */
export function buildThemeScript(): string {
  const config = JSON.stringify({
    key: THEME_STORAGE_KEY,
    presets: PRESET_IDS,
    preset: DEFAULT_PREFERENCE.preset,
    mode: DEFAULT_PREFERENCE.mode,
  });
  return `(function(){var c=${config};var p=c.preset,m=c.mode;try{var s=JSON.parse(localStorage.getItem(c.key)||"{}");if(c.presets.indexOf(s.preset)>-1)p=s.preset;if(s.mode==="light"||s.mode==="dark"||s.mode==="system")m=s.mode}catch(e){}var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var h=document.documentElement;h.setAttribute("data-theme",p);h.setAttribute("data-mode",d?"dark":"light")})()`;
}
