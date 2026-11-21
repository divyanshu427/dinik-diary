import { expect, test, type Page } from "@playwright/test";

const P1 = "Phase 1 · Foundation";
const phase = (page: Page, name: string) => page.getByRole("region", { name });
const toggle = (page: Page, name: string) =>
  phase(page, name).locator('button[aria-controls^="phase-list-"]');
const detail = (page: Page) => page.getByRole("region", { name: "Habit details" });
const names = (page: Page) => phase(page, P1).locator("[data-habit-name]");

async function openHabits(page: Page) {
  await page.goto("/habits");
  await expect(phase(page, P1)).toBeVisible();
  await toggle(page, P1).click();
  await expect(names(page).first()).toBeVisible();
}

test.describe("laptop dashboard layout", () => {
  test.skip(({ isMobile }) => isMobile, "laptop widths only");

  for (const width of [1440, 1920]) {
    test(`content fills the width at ${width} px (no big empty sides)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/habits");
      await expect(phase(page, P1)).toBeVisible();
      const sidebar = 240;
      const main = (await page.locator("#content").boundingBox())!;
      const available = width - sidebar;
      // Content may stop at ~1600 px on very wide screens, but must use at least 90% of the space.
      expect(main.width / available).toBeGreaterThanOrEqual(0.9);
      expect(main.x - sidebar).toBeLessThanOrEqual(available * 0.05 + 1);
    });
  }

  test("habits list and detail panel sit side by side at 1280 px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openHabits(page);
    const list = (await phase(page, P1).boundingBox())!;
    const panel = (await detail(page).boundingBox())!;
    expect(panel.x).toBeGreaterThan(list.x + list.width - 1);
    expect(Math.abs(panel.y - list.y)).toBeLessThan(200); // same row, not stacked below

    // Four summary tiles in one row
    const tiles = page.getByText(
      /^(Active habits|14-day average|Best current streak|Needs attention)$/,
    );
    await expect(tiles).toHaveCount(4);
    const ys = await Promise.all(
      [0, 1, 2, 3].map(async (i) => (await tiles.nth(i).boundingBox())!.y),
    );
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
  });

  test("clicking a habit shows its details; target history appears after a change", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openHabits(page);
    await expect(detail(page)).toContainText("Wake up on time"); // first active habit by default

    await phase(page, P1)
      .getByRole("button", { name: /^Daily steps/ })
      .click();
    await expect(detail(page).getByRole("heading", { name: "Daily steps" })).toBeVisible();
    await expect(detail(page)).toContainText("5,000 steps");
    await expect(detail(page)).toContainText("Last 30 days");

    await detail(page).getByRole("button", { name: "Edit" }).click();
    await page.getByRole("dialog").getByLabel("Target", { exact: true }).fill("8000");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    const history = detail(page).getByRole("region", { name: "Target history" });
    await expect(history).toContainText("8,000 steps");
    await expect(history).toContainText("5,000 steps");
  });
});

test.describe("filters and part of day", () => {
  test("the Night filter shows only night habits and switches dragging off", async ({ page }) => {
    await openHabits(page);
    await expect(page.getByText("11 active habits, 29 more waiting in later phases")).toBeVisible();

    await page
      .getByRole("group", { name: "Filter habits" })
      .getByRole("button", { name: "Night" })
      .click();
    await expect(names(page)).toHaveText([
      "Brush teeth — night",
      "Face wash — night",
      "In bed on time",
    ]);
    await expect(page.getByRole("button", { name: /^Drag to move/ })).toHaveCount(0);
    await expect(page.getByText("Clear the filter to drag habits.")).toBeVisible();

    await page
      .getByRole("group", { name: "Filter habits" })
      .getByRole("button", { name: "All" })
      .click();
    await expect(names(page)).toHaveCount(11);
  });

  test("part of day can be changed and shows on the habit", async ({ page }) => {
    await openHabits(page);
    await page.getByRole("button", { name: "Actions for Bath" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByRole("dialog").getByLabel("Part of day").selectOption("evening");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(phase(page, P1).getByRole("button", { name: /^Bath/ })).toContainText("Evening");
  });
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  test("tapping a habit opens its details as a full page; back closes it", async ({ page }) => {
    await openHabits(page);
    await expect(detail(page)).toHaveCount(0); // no side panel on phones
    await phase(page, P1).getByRole("button", { name: /^Bath/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Bath" })).toBeVisible();
    await expect(dialog).toContainText("Last 30 days");
    // Fills the screen from the top (once it has slid in).
    await expect.poll(async () => (await dialog.boundingBox())?.y).toBeLessThanOrEqual(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // The phone's back gesture closes it and stays on Habits.
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL("/habits");

    await phase(page, P1).getByRole("button", { name: /^Bath/ }).click();
    await dialog.getByRole("button", { name: "Back" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("menus open as a bottom sheet with descriptions", async ({ page }) => {
    await openHabits(page);
    await page.getByRole("button", { name: "Actions for Wake up on time" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("menuitem", { name: "Edit habit" })).toHaveAccessibleDescription(
      "Name, target, how often, category",
    );
    await sheet.getByRole("menuitem", { name: "Reorder" }).click();
    await expect(sheet.getByRole("menuitem", { name: "Move up" })).toHaveAttribute(
      "aria-disabled",
      "true",
    ); // it's already first
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await expect(sheet).toHaveCount(0);
  });
});
