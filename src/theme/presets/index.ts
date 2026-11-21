import type { ThemePreset } from "../tokens";
import { mono } from "./mono";
import { sage } from "./sage";

/** All available presets, in the order shown in Settings. Add a new theme here. */
export const PRESETS: readonly ThemePreset[] = [sage, mono];

export const PRESET_IDS = PRESETS.map((p) => p.id);

export function getPreset(id: string): ThemePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
