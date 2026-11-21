import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const banner = (page: Page) => page.getByRole("status").filter({ hasText: "Demo data" });
const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

async function openDemo(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Open demo data" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(banner(page)).toBeVisible();
}

async function openReports(page: Page) {
  await page.goto("/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await expect(page.getByText("Working out your report…")).toHaveCount(0);
}

/** The share shown for a legend row, e.g. 31.5 for "Sleep and rest … 31.5%"; 0 when not shown. */
async function share(page: Page, label: string) {
  const row = page.getByTestId("time-donut").locator(`[data-slice="${label}"]`);
  if ((await row.count()) === 0) return 0;
  return Number(/([\d.]+)%/.exec((await row.textContent()) ?? "")?.[1] ?? NaN);
}

test.describe("Reports on demo data", () => {
  test("every card renders with real numbers", async ({ page }) => {
    await openDemo(page);
    await openReports(page);

    const tiles = page.getByTestId("report-tiles");
    await expect(tiles).toContainText("Habit completion");
    await expect(tiles).toContainText("Longest habit streak");
    await expect(tiles).toContainText("Reels and social media");
    await expect(tiles).not.toContainText("—");

    // Time donut + legend; waking time leaves out the nights.
    const donut = page.getByTestId("time-donut");
    await expect(donut.locator('[data-slice="Unlogged"]')).toBeVisible();
    expect(await share(page, "Sleep and rest")).toBeGreaterThan(20);
    await card(page, "Where your time went").getByRole("radio", { name: "Waking time" }).click();
    await expect.poll(() => share(page, "Sleep and rest")).toBeLessThan(5);

    // Calendar: one cell per day of the month, labelled with that day's completion.
    const calendar = card(page, "Daily completion");
    await expect(calendar.getByRole("listitem")).toHaveCount(30);
    await expect(
      calendar.getByRole("listitem", { name: /% of habits done/ }).first(),
    ).toBeVisible();

    // Category drill-down: open Travel to see each trip.
    const travel = page
      .getByTestId("categories")
      .locator('[data-category="Travel and exploration"]');
    await travel.locator("summary").click();
    await expect(travel.getByRole("listitem").first()).toBeVisible();

    await expect(page.getByTestId("insights").getByRole("listitem").first()).toBeVisible();
    await expect(page.getByTestId("ranking-top").getByRole("listitem")).toHaveCount(5);
    await expect(page.getByTestId("ranking-bottom").getByRole("listitem")).toHaveCount(5);

    // Trends: pick Steps; its target is the Daily steps habit's.
    const trends = card(page, "Trends");
    const steps = trends.getByRole("button", { name: "Steps", exact: true });
    await steps.click();
    await expect(steps).toHaveAttribute("aria-pressed", "true");
    await expect(trends).toContainText("Target 8,000 steps"); // Phase 2 raised it in the demo
    await expect(trends.locator(".recharts-line-curve")).toBeVisible();
  });

  test("last month's tile matches the exported CSV", async ({ page }) => {
    await openDemo(page);
    await openReports(page);
    await page.getByRole("button", { name: "Previous period" }).click();
    await expect(page.getByRole("button", { name: "Next period" })).toBeEnabled();

    const tile = page.getByTestId("report-tiles").locator("> div").first();
    await expect(tile).toContainText("Habit completion");
    const shown = Number(/(\d+)%/.exec((await tile.textContent()) ?? "")?.[1]);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^dinik-diary-report-\d{4}-\d{2}-01-to-/);
    const csv = await readFile((await download.path())!, "utf8");
    const [header, ...rows] = csv.trim().split("\r\n");
    expect(header).toMatch(/^Date,Day type,Habits done,Habits due,Average progress \(%\)/);
    expect(rows.length).toBeGreaterThanOrEqual(28); // the whole month, one row per day

    // The tile is the average of the normal days' averages (rest days left out).
    const averages = rows
      .map((row) => row.split(","))
      .filter((cols) => cols[1] === "Normal" && cols[4] !== "")
      .map((cols) => Number(cols[4]));
    const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
    expect(Math.abs(Math.round(mean) - shown)).toBeLessThanOrEqual(1);
  });

  test("all time uses the compact calendar; back to my data shows the empty report", async ({
    page,
  }) => {
    await openDemo(page);
    await openReports(page);
    await page.getByRole("radio", { name: "All time" }).click();
    await expect(page.getByRole("button", { name: "Previous period" })).toHaveCount(0);
    await expect(card(page, "Daily completion").getByRole("listitem")).toHaveCount(60);

    await banner(page).getByRole("button", { name: "Back to my data" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(banner(page)).toHaveCount(0);
    await openReports(page);
    await expect(page.getByText("Nothing logged in this period yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  test("a habit's panel explains its weekday pattern", async ({ page, isMobile }) => {
    test.skip(isMobile, "the detail panel opens in a dialog on phones; covered on laptop");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openDemo(page);
    await page.goto("/habits");
    const phase1 = page.getByRole("region", { name: /Phase 1/ });
    await phase1.getByRole("button", { name: /^Phase 1 · Foundation/ }).click();
    await phase1.getByRole("button", { name: /^Daily steps/ }).click();
    const detail = page.getByRole("region", { name: "Habit details" });
    await expect(detail.getByTestId("habit-insight")).toContainText(
      "You hit this most on weekends",
    );
  });
});

test.describe("Reports layout on a laptop", () => {
  test.skip(({ isMobile }) => isMobile, "laptop only");

  test("donut beside the calendar on the dashboard grid", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openDemo(page);
    await openReports(page);
    const time = (await card(page, "Where your time went").boundingBox())!;
    const calendar = (await card(page, "Daily completion").boundingBox())!;
    expect(calendar.x).toBeGreaterThan(time.x + time.width - 10);
    expect(Math.abs(calendar.y - time.y)).toBeLessThan(5);
  });
});
