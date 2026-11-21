import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildThemeScript,
  DEFAULT_PREFERENCE,
  parsePreference,
  resolveMode,
  THEME_STORAGE_KEY,
} from "./preference";

describe("parsePreference", () => {
  it("returns defaults for empty or broken values", () => {
    expect(parsePreference(null)).toEqual(DEFAULT_PREFERENCE);
    expect(parsePreference("not json")).toEqual(DEFAULT_PREFERENCE);
  });

  it("keeps valid values", () => {
    expect(parsePreference('{"preset":"mono","mode":"dark"}')).toEqual({
      preset: "mono",
      mode: "dark",
    });
  });

  it("replaces unknown presets and modes with defaults", () => {
    expect(parsePreference('{"preset":"nope","mode":"purple"}')).toEqual(DEFAULT_PREFERENCE);
  });
});

describe("resolveMode", () => {
  it("follows the system only in system mode", () => {
    expect(resolveMode("system", true)).toBe("dark");
    expect(resolveMode("system", false)).toBe("light");
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
  });
});

describe("theme head script", () => {
  const root = document.documentElement;
  const run = () => new Function(buildThemeScript())();
  const stubSystemDark = (dark: boolean) =>
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: dark && q.includes("dark") }));

  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute("data-theme");
    root.removeAttribute("data-mode");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("applies the saved preset and mode", () => {
    stubSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ preset: "mono", mode: "dark" }));
    run();
    expect(root.dataset.theme).toBe("mono");
    expect(root.dataset.mode).toBe("dark");
  });

  it("uses the system setting when nothing is saved", () => {
    stubSystemDark(true);
    run();
    expect(root.dataset.theme).toBe(DEFAULT_PREFERENCE.preset);
    expect(root.dataset.mode).toBe("dark");
  });

  it("ignores an unknown saved preset", () => {
    stubSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ preset: "hacked", mode: "light" }));
    run();
    expect(root.dataset.theme).toBe(DEFAULT_PREFERENCE.preset);
    expect(root.dataset.mode).toBe("light");
  });
});
