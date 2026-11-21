import { expect, test } from "@playwright/test";

const PAGES = [
  ["/", "About Today"],
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
