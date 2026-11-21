import { ALL_TOKENS, type ThemePreset, type ThemeTokens } from "./tokens";

function declarations(tokens: ThemeTokens): string {
  return ALL_TOKENS.map((t) => `--${t}:${tokens[t]};`).join("");
}

/**
 * Builds the CSS that defines every token for every preset, in light and dark.
 *
 * Tokens are scoped by two attributes, so any element can carry its own theme
 * (the /brand page uses this to show light and dark side by side):
 *   <html data-theme="sage" data-mode="dark">
 *
 * The default preset in light mode is also applied to :root as a fallback.
 */
export function buildThemeCss(presets: readonly ThemePreset[], defaultPresetId: string): string {
  const fallback = presets.find((p) => p.id === defaultPresetId) ?? presets[0];
  const rules = [`:root{${declarations(fallback.light)}}`];
  for (const preset of presets) {
    const sel = `[data-theme="${preset.id}"]`;
    rules.push(`${sel}[data-mode="light"]{${declarations(preset.light)}color-scheme:light;}`);
    rules.push(`${sel}[data-mode="dark"]{${declarations(preset.dark)}color-scheme:dark;}`);
  }
  return rules.join("\n");
}
