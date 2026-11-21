/**
 * Every colour the app uses is one of these tokens.
 * Components reference them through Tailwind classes (bg-primary, text-muted-foreground, ...),
 * never as raw colour values. A theme preset must define all of them for light and dark.
 */
export const CORE_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "success",
  "warning",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

/** Categorical slots, in fixed order. The order is part of the colour-blind safety check. */
export const CHART_TOKENS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
] as const;

/** Neutral slices: "Other" (folded categories) and "Unlogged" (time with no entry). */
export const NEUTRAL_CHART_TOKENS = ["chart-other", "chart-unlogged"] as const;

/** Heatmap scale, lightest (fewest) to strongest (most). One hue only. */
export const HEATMAP_TOKENS = [
  "heatmap-0",
  "heatmap-1",
  "heatmap-2",
  "heatmap-3",
  "heatmap-4",
] as const;

export const ALL_TOKENS = [
  ...CORE_TOKENS,
  ...CHART_TOKENS,
  ...NEUTRAL_CHART_TOKENS,
  ...HEATMAP_TOKENS,
] as const;

export type TokenName = (typeof ALL_TOKENS)[number];
export type ChartToken = (typeof CHART_TOKENS)[number];
export type ThemeTokens = Record<TokenName, string>;

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

/** CSS variable for a token, e.g. tokenVar("chart-3") → "var(--chart-3)". */
export const tokenVar = (token: TokenName) => `var(--${token})`;
