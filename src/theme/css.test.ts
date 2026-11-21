import { describe, expect, it } from "vitest";
import { buildThemeCss } from "./css";
import { PRESETS } from "./presets";
import { ALL_TOKENS } from "./tokens";

describe("buildThemeCss", () => {
  const css = buildThemeCss(PRESETS, "sage");

  it("has a light and dark rule for every preset", () => {
    for (const p of PRESETS) {
      expect(css).toContain(`[data-theme="${p.id}"][data-mode="light"]{`);
      expect(css).toContain(`[data-theme="${p.id}"][data-mode="dark"]{`);
    }
  });

  it("declares every token in every rule", () => {
    const rules = css.split("\n");
    expect(rules).toHaveLength(1 + PRESETS.length * 2);
    for (const rule of rules) {
      for (const token of ALL_TOKENS) expect(rule).toContain(`--${token}:`);
    }
  });

  it("uses the default preset's light colours on :root", () => {
    const sage = PRESETS.find((p) => p.id === "sage")!;
    expect(css.split("\n")[0]).toContain(`--primary:${sage.light.primary};`);
  });
});
