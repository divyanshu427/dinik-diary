"use client";

import { SegmentedControl } from "@/components/segmented-control";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";
import { useUpdateSettings } from "@/hooks/use-data";
import { CHART_TOKENS, tokenVar, type ThemeMode } from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";

const MODE_OPTIONS = (["light", "dark", "system"] as const).map((value) => ({
  value,
  label: copy.theme.modes[value],
}));

/**
 * Pick a theme preset and light/dark/system mode.
 * Applies instantly (and to localStorage, for flash-free loading) and saves to settings.
 */
export function ThemeControls() {
  const theme = useTheme();
  const { preset, mode, resolvedMode, presets } = theme;
  const { mutate: saveSettings } = useUpdateSettings();

  const setPreset = (id: string) => {
    theme.setPreset(id);
    saveSettings({ themePreset: id });
  };
  const setMode = (value: ThemeMode) => {
    theme.setMode(value);
    saveSettings({ colorMode: value });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p id="preset-label" className="mb-2 text-sm font-medium">
          {copy.theme.presetLabel}
        </p>
        <div role="radiogroup" aria-labelledby="preset-label" className="grid gap-3 sm:grid-cols-2">
          {presets.map((p) => {
            const selected = p.id === preset;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPreset(p.id)}
                className={cn(
                  "rounded-xl border bg-card p-4 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected && "border-primary ring-1 ring-primary",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-heading font-semibold">{p.label}</span>
                  {/* Swatches render in this preset's own colours, whatever the current theme is. */}
                  <span
                    data-theme={p.id}
                    data-mode={resolvedMode}
                    className="flex gap-1 rounded-md bg-background p-1"
                    aria-hidden
                  >
                    <span className="size-3.5 rounded-sm bg-primary" />
                    {CHART_TOKENS.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="size-3.5 rounded-sm"
                        style={{ background: tokenVar(t) }}
                      />
                    ))}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{p.description}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{copy.theme.modeLabel}</p>
        <SegmentedControl<ThemeMode>
          label={copy.theme.modeLabel}
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
        />
      </div>
    </div>
  );
}
