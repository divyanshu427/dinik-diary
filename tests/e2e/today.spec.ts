import { expect, test, type Page } from "@playwright/test";

const box = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true });
const row = (page: Page, name: string) => page.locator(`[data-habit-row="${name}"]`);

async function openToday(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Checklist" })).toBeVisible();
}

test.describe("Today screen", () => {
  test("tick 3 habits: the ring updates and ticks survive a reload", async ({ page }) => {
    await openToday(page);
    await expect(page.getByRole("img", { name: "0 of 10 done" })).toBeVisible();

    for (const name of ["Bath", "Brush teeth — morning", "Healthy breakfast"])
      await box(page, name).click();
    await expect(page.getByRole("img", { name: "3 of 10 done" })).toBeVisible();
    await expect(box(page, "Bath")).toHaveAttribute("aria-checked", "true");

    await page.reload();
    await expect(page.getByRole("img", { name: "3 of 10 done" })).toBeVisible();
    await expect(box(page, "Bath")).toHaveAttribute("aria-checked", "true");

    // Unticking works too.
    await box(page, "Bath").click();
    await expect(page.getByRole("img", { name: "2 of 10 done" })).toBeVisible();
  });

  test("steps: quick add, then a partial total shows as partial", async ({ page }) => {
    await openToday(page);
    const steps = row(page, "Daily steps");
    await steps.getByRole("button", { name: "Add 500 to Daily steps" }).click();
    await steps.getByRole("button", { name: "Add 1,000 to Daily steps" }).click();
    await expect(steps).toContainText("1,500 / 5,000 steps");

    await steps.getByRole("button", { name: "Enter total" }).click();
    await steps.getByLabel("Total for Daily steps").fill("3420");
    await steps.getByRole("button", { name: "Save" }).click();
    await expect(steps).toContainText("3,420 / 5,000 steps");
    await expect(steps.getByRole("img", { name: "Partly done" })).toBeVisible();

    await steps.getByRole("button", { name: "Enter total" }).click();
    await steps.getByLabel("Total for Daily steps").fill("5200");
    await steps.getByRole("button", { name: "Save" }).click();
    await expect(steps.getByRole("img", { name: "Done", exact: true })).toBeVisible();
  });

  test("wake-up time: 7:40 is shown as 10 minutes late", async ({ page }) => {
    await openToday(page);
    const wake = row(page, "Wake up on time");
    await wake.getByLabel("Time for Wake up on time").fill("07:40");
    await expect(wake).toContainText("10 min late");
    await expect(wake.getByRole("img", { name: "Partly done" })).toBeVisible();
  });

  test("log yesterday from the date controls", async ({ page }) => {
    await openToday(page);
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Yesterday" })).toBeVisible();
    await box(page, "Bath").click();
    await expect(box(page, "Bath")).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Back to today" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(box(page, "Bath")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();

    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(box(page, "Bath")).toHaveAttribute("aria-checked", "true");
  });

  test("mark a rest day; it is remembered", async ({ page }) => {
    await openToday(page);
    await page
      .getByRole("radiogroup", { name: "Day type" })
      .getByRole("radio", { name: "Rest" })
      .click();
    await expect(page.getByText(/Rest day: streaks are paused/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Rest day: streaks are paused/)).toBeVisible();
  });

  test("add a note to a check-in", async ({ page }) => {
    await openToday(page);
    await box(page, "Healthy breakfast").click();
    await page.getByRole("button", { name: "Add a note to Healthy breakfast" }).click();
    await page.getByRole("dialog").getByLabel("Note").fill("Guava");
    await page.getByRole("dialog").getByRole("button", { name: "Save note" }).click();
    await expect(row(page, "Healthy breakfast")).toContainText("“Guava”");
  });

  test("ticks show up on the Habits screen", async ({ page }) => {
    await openToday(page);
    await box(page, "Bath").click();
    await expect(box(page, "Bath")).toHaveAttribute("aria-checked", "true");
    await page.goto("/habits");
    const p1 = page.getByRole("region", { name: "Phase 1 · Foundation" });
    await p1.locator('button[aria-controls^="phase-list-"]').click();
    await expect(
      p1.getByRole("button", { name: /^Bath/ }).locator("xpath=ancestor::li[1]"),
    ).toContainText("100%");
  });
});

test.describe("Today layout on a laptop", () => {
  test.skip(({ isMobile }) => isMobile, "laptop only");

  test("checklist and side column sit side by side; tiles in one row", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openToday(page);
    const checklist = (await page
      .getByRole("heading", { level: 2, name: "Checklist" })
      .boundingBox())!;
    const dayType = (await page
      .getByRole("heading", { level: 2, name: "Day type" })
      .boundingBox())!;
    expect(dayType.x).toBeGreaterThan(checklist.x + 300);
    expect(Math.abs(dayType.y - checklist.y)).toBeLessThan(40);

    const labels = page.getByText(/^(Habits done|Current streak|Next phase|Left before bed)$/);
    await expect(labels).toHaveCount(4);
    const ys = await Promise.all(
      [0, 1, 2, 3].map(async (i) => (await labels.nth(i).boundingBox())!.y),
    );
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(30);
  });
});
