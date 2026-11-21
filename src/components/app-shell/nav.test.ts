import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isActive, isMoreActive, MORE_HREF, MORE_ITEMS, NAV_ITEMS, TAB_ITEMS } from "./nav";

describe("navigation config", () => {
  it("has 4 bottom tabs (+ More) so the phone bar fits", () => {
    expect(TAB_ITEMS).toHaveLength(4);
  });

  it("has unique links", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each([...NAV_ITEMS.map((i) => i.href), MORE_HREF])("%s has a page file", (href) => {
    const file = join(process.cwd(), "src/app/(app)", href, "page.tsx");
    expect(existsSync(file), file).toBe(true);
  });
});

describe("isActive", () => {
  it("matches Today only on the home path", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/reports")).toBe(false);
  });

  it("matches a screen and its sub-pages, not lookalike paths", () => {
    expect(isActive("/habits", "/habits")).toBe(true);
    expect(isActive("/habits", "/habits/123")).toBe(true);
    expect(isActive("/habits", "/habits-archive")).toBe(false);
  });
});

describe("isMoreActive", () => {
  it("is active on the More screen and every screen listed in it", () => {
    expect(isMoreActive("/more")).toBe(true);
    for (const item of MORE_ITEMS) expect(isMoreActive(item.href)).toBe(true);
  });

  it("is not active on bottom-tab screens", () => {
    for (const item of TAB_ITEMS) expect(isMoreActive(item.href)).toBe(false);
  });
});
