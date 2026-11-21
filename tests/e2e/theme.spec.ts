import { expect, test } from "@playwright/test";

test.describe("theme switching on /brand", () => {
  test("preset and mode choice persists after reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/brand");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "sage");
    await expect(html).toHaveAttribute("data-mode", "light");

    const sageBg = await bodyBackground(page);

    await page.getByRole("radio", { name: /Mono/ }).click();
    await page
      .getByRole("radiogroup", { name: "Mode" })
      .getByRole("radio", { name: "Dark" })
      .click();
    await expect(html).toHaveAttribute("data-theme", "mono");
    await expect(html).toHaveAttribute("data-mode", "dark");
    expect(await bodyBackground(page)).not.toBe(sageBg);

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "mono");
    await expect(html).toHaveAttribute("data-mode", "dark");
    await expect(page.getByRole("radio", { name: /Mono/ })).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("radiogroup", { name: "Mode" }).getByRole("radio", { name: "Dark" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("system mode follows the device setting", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/brand");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
  });

  test("the page has no horizontal scroll", async ({ page }) => {
    await page.goto("/brand");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

function bodyBackground(page: import("@playwright/test").Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}
