import { expect, test, type Page } from "@playwright/test";

/** Every screen, its nav label and its page heading. */
const SCREENS = [
  { href: "/", label: "Today", heading: "Today", tab: true },
  { href: "/habits", label: "Habits", heading: "Habits", tab: true },
  { href: "/activities", label: "Activities", heading: "Activities", tab: true },
  { href: "/reports", label: "Reports", heading: "Reports", tab: true },
  { href: "/phases", label: "Phases", heading: "Phases", tab: false },
  { href: "/health", label: "Health", heading: "Health", tab: false },
  { href: "/settings", label: "Settings", heading: "Settings", tab: false },
  { href: "/brand", label: "Brand preview", heading: "Brand preview", tab: false },
];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

const heading = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });
const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main navigation" });

test.describe("desktop: sidebar", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("reaches every screen from the sidebar", async ({ page }) => {
    await page.goto("/");
    const nav = mainNav(page);
    await expect(nav).toBeVisible();

    for (const screen of SCREENS) {
      await nav.getByRole("link", { name: screen.label, exact: true }).click();
      await expect(page).toHaveURL(screen.href);
      await expect(heading(page, screen.heading)).toBeVisible();
      await expect(nav.getByRole("link", { name: screen.label, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expectNoHorizontalScroll(page);
    }
  });
});

test.describe("phone: bottom tabs at 375 px", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");
  test.use({ viewport: { width: 375, height: 812 } });

  test("reaches every screen from the tabs and the More sheet", async ({ page }) => {
    await page.goto("/");
    const nav = mainNav(page);
    await expect(nav).toBeVisible();

    for (const screen of SCREENS) {
      if (screen.tab) {
        await nav.getByRole("link", { name: screen.label, exact: true }).click();
      } else {
        await nav.getByRole("button", { name: "More", exact: true }).click();
        await page.getByTestId("more-sheet").getByRole("link", { name: screen.label }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(nav.getByRole("button", { name: "More", exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        );
      }
      await expect(page).toHaveURL(screen.href);
      await expect(heading(page, screen.heading)).toBeVisible();
      // The same logo row sits above every page.
      await expect(page.getByRole("main").getByRole("link", { name: /Dinik Diary/ })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });

  test("the tab bar does not cover the end of the page", async ({ page }) => {
    await page.goto("/brand");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const lastText = page.getByText("Secondary text for hints and captions.");
    const tabBar = await mainNav(page).boundingBox();
    const text = await lastText.boundingBox();
    expect(text!.y + text!.height).toBeLessThanOrEqual(tabBar!.y);
  });
});

test("settings: theme choice applies across screens", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("radio", { name: /Mono/ }).click();
  await page.goto("/reports");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "mono");
});
