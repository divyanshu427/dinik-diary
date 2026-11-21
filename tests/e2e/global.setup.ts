import { expect, test as setup } from "@playwright/test";

/** Where the browser state after the first-run question is saved (gitignored). */
export const STARTED = "tests/e2e/.state/started.json";

/**
 * A fresh app asks "Which habits do you want to start with?". Most tests want the classic
 * setup, so this answers "Start all" once and saves the browser state (with its database);
 * every test then starts from a copy of it. first-run.spec.ts tests the question itself.
 */
setup("answer the first-run question: start all of Phase 1", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Start all \d+ instead$/ }).click();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByTestId("first-run")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Checklist" })).toBeVisible();
  await page.context().storageState({ path: STARTED, indexedDB: true });
});
