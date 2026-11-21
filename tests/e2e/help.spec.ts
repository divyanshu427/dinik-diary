import { expect, test } from "@playwright/test";

/** Pages that still explain themselves with a sheet (the others have a spotlight tour). */
const PAGES = [
  ["/habits", "About Habits"],
  ["/activities", "About Activities"],
  ["/reports", "About Reports"],
  ["/phases", "About Phases"],
  ["/health", "About Health"],
  ["/health/reports", "About Reports and values"],
  ["/settings", "About Settings"],
] as const;

test.describe("page help (the ⓘ button)", () => {
  test("every page has an icon-only ⓘ that opens its own explanation", async ({ page }) => {
    for (const [path, title] of PAGES) {
      await page.goto(path);
      // One ⓘ is showing: in the logo row on phones, beside the title on a laptop.
      const button = page.getByRole("button", { name: "About this page" }).locator("visible=true");
      await expect(button).toHaveCount(1);
      await expect(button).toHaveText(""); // icon only, no word "Help"
      await button.click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(sheet).toContainText("When you change something");
      await sheet.getByRole("button", { name: "Close", exact: true }).first().click();
      await expect(sheet).toHaveCount(0);
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
