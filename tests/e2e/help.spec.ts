import { expect, test } from "@playwright/test";

/** Every page's ⓘ starts its own tour; the first step's title shows which one. */
const PAGES = [
  // [page, a part to wait for (the page has loaded), first step's title]
  ["/habits", "habits-phase", "Add your own"],
  ["/activities", "activities-log", /^(Three views|Log what you did)$/], // tabs: phones only
  ["/reports", "reports-period", "Pick a period"],
  ["/phases", "phases-current", "Your current phase"],
  ["/health", "health-add", "Two parts"],
  ["/health/reports", "hr-add", "Reports and values"],
  ["/settings", "settings-account", "Sign in to sync"],
] as const;

test.describe("page help (the ⓘ button)", () => {
  test("every page has an icon-only ⓘ that starts its own tour", async ({ page }) => {
    for (const [path, loaded, first] of PAGES) {
      await page.goto(path);
      await expect(page.locator(`[data-tour="${loaded}"]`).first()).toBeVisible();
      // One ⓘ is showing: in the logo row on phones, beside the title on a laptop.
      const button = page.getByRole("button", { name: "About this page" }).locator("visible=true");
      await expect(button).toHaveCount(1);
      await expect(button).toHaveText(""); // icon only, no word "Help"
      await button.click();
      const card = page.getByTestId("tour").getByRole("dialog");
      await expect(card).toContainText(/Step 1 of \d/);
      await expect(card.getByRole("heading", { name: first })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("tour")).toHaveCount(0);
    }
  });
});

test.describe("page tour", () => {
  test("ⓘ on Today starts a spotlight tour: Next, Back, Skip and Done", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Checklist" })).toBeVisible();
    const open = () =>
      page.getByRole("button", { name: "About this page" }).locator("visible=true").click();
    const tour = page.getByTestId("tour");
    const card = tour.getByRole("dialog");

    await open();
    await expect(card).toContainText(/Step 1 of \d/);
    await expect(card.getByRole("heading", { name: "Your day at a glance" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Back" })).toHaveCount(0);

    await card.getByRole("button", { name: "Next" }).click();
    await expect(card).toContainText(/Step 2 of \d/);
    await expect(card.getByRole("heading", { name: "Look at another day" })).toBeVisible();
    await card.getByRole("button", { name: "Back" }).click();
    await expect(card.getByRole("heading", { name: "Your day at a glance" })).toBeVisible();

    await card.getByRole("button", { name: "Skip tour" }).click();
    await expect(tour).toHaveCount(0);

    // Esc ends it too.
    await open();
    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);

    // Through to the end: the last step says Done.
    await open();
    for (let i = 0; i < 10; i++) {
      const done = card.getByRole("button", { name: "Done" });
      if (await done.isVisible()) break;
      await card.getByRole("button", { name: "Next" }).click();
    }
    await expect(card.getByRole("heading", { name: "Your day, hour by hour" })).toBeVisible();
    await card.getByRole("button", { name: "Done" }).click();
    await expect(tour).toHaveCount(0);
  });
});
