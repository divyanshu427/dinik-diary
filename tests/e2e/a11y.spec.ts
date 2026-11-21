import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/*
 * Accessibility pass (Build Phase 13): axe-core on every screen, with demo data so the pages are
 * full, in light and dark mode. WCAG 2.1 A and AA rules, including colour contrast.
 */

const AXE = path.resolve("node_modules/axe-core/axe.min.js");
const ROUTES = [
  "/",
  "/habits",
  "/activities",
  "/reports",
  "/phases",
  "/health",
  "/health/reports",
  "/settings",
  "/more",
  "/brand",
];

async function violations(page: Page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (...args: unknown[]) => Promise<unknown> } })
      .axe;
    const result = (await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    })) as { violations: { id: string; nodes: { target: string[] }[] }[] };
    return result.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
  });
}

test("every screen passes the automatic accessibility check, light and dark", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(120_000);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Open demo data" }).click();
  await expect(page).toHaveURL(/\/$/);

  for (const scheme of isMobile ? (["light"] as const) : (["light", "dark"] as const)) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/^Loading|Working out/)).toHaveCount(0);
      expect(await violations(page), `${scheme} ${route}`).toEqual([]);
    }
  }
});
