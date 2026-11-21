import { describe, expect, it } from "vitest";
import { brand } from "@/brand/brand.config";
import { HEATMAP_INK } from "@/components/charts/completion-heatmap";
import { contrastRatio } from "./contrast";
import { getPreset, PRESETS } from "./presets";
import { ALL_TOKENS, HEATMAP_TOKENS, type ThemeTokens, type TokenName } from "./tokens";

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Text token on background token, minimum 4.5:1 (WCAG AA for normal text). */
const TEXT_PAIRS: [TokenName, TokenName][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["primary-foreground", "primary"],
  ["primary", "card"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive", "card"],
  ["success", "card"],
  ["warning", "card"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
];

const modes = PRESETS.flatMap((p) =>
  (["light", "dark"] as const).map((mode) => ({ name: `${p.id} ${mode}`, tokens: p[mode] })),
);

describe("theme presets", () => {
  it("includes the default theme from brand config", () => {
    expect(getPreset(brand.defaultTheme)).toBeDefined();
  });

  it("has unique ids", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(modes)("$name", ({ tokens }: { tokens: ThemeTokens }) => {
    it("defines every token as a #RRGGBB colour", () => {
      for (const token of ALL_TOKENS) {
        expect(tokens[token], token).toMatch(HEX);
      }
    });

    it.each(TEXT_PAIRS)("%s on %s is readable (>= 4.5:1)", (text, bg) => {
      expect(contrastRatio(tokens[text], tokens[bg])).toBeGreaterThanOrEqual(4.5);
    });

    it("heatmap day numbers are readable on every level", () => {
      HEATMAP_TOKENS.forEach((level, i) => {
        const ink = HEATMAP_INK[i] === "text-foreground" ? "foreground" : "primary-foreground";
        expect(contrastRatio(tokens[ink], tokens[level]), level).toBeGreaterThanOrEqual(4.5);
      });
    });
  });
});
