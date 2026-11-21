import { expect, test } from "@playwright/test";

// A truly fresh app (no saved state): the first-run question shows.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("first run", () => {
  test("pick a few Phase 1 habits; only they are on Today, the rest wait", async ({ page }) => {
    await page.goto("/");
    const first = page.getByTestId("first-run");
    await expect(
      first.getByRole("heading", { name: "Which habits do you want to start with?" }),
    ).toBeVisible();
    // Four easy ones are suggested; untick one and tick another.
    await expect(first.getByRole("checkbox", { checked: true })).toHaveCount(4);
    await first.getByRole("checkbox", { name: /In bed on time/ }).click();
    await first.getByRole("checkbox", { name: /Bath/ }).click();
    await first.getByRole("button", { name: "Start with 4 habits" }).click();
    await expect(first.getByRole("heading", { name: /Want a quick tour/ })).toBeVisible();
    await first.getByRole("button", { name: "Not now" }).click();
    await expect(first).toHaveCount(0);

    await expect(page.getByRole("img", { name: "0 of 4 done" })).toBeVisible();
    await expect(page.locator('[data-habit-row="Bath"]')).toBeVisible();
    await expect(page.locator('[data-habit-row="In bed on time"]')).toHaveCount(0);
    await page.getByText("Not due today (7)").click();
    await expect(page.locator('[data-not-due="In bed on time"]')).toContainText("Not started");

    // It doesn't ask again.
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Checklist" })).toBeVisible();
    await expect(page.getByTestId("first-run")).toHaveCount(0);
  });

  test("'Show me' starts the Today tour", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Start all \d+ instead$/ }).click();
    await page.getByRole("button", { name: "Show me" }).click();
    await expect(page.getByTestId("tour").getByRole("dialog")).toContainText(/Step 1 of \d/);
  });
});
