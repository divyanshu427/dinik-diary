import { expect, test, type Page } from "@playwright/test";

const P1 = "Phase 1 · Foundation";
const P2 = "Phase 2 · Fitness and grooming";
const P3 = "Phase 3 · Sleep and mind";

const current = (page: Page) => page.getByTestId("current-phase");
const card = (page: Page, name: string) => page.locator(`[data-phase="${name}"]`);
const habitRow = (page: Page, name: string) => page.locator(`[data-habit-row="${name}"]`);

async function openPhases(page: Page) {
  await page.goto("/phases");
  await expect(page.getByRole("heading", { level: 1, name: "Phases" })).toBeVisible();
  await expect(page.getByText("Loading your phases…")).toHaveCount(0);
}

async function openToday(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Checklist" })).toBeVisible();
}

test.describe("phase manager", () => {
  test("enable Phase 2: its habits join Today and daily steps becomes 8,000", async ({ page }) => {
    await openPhases(page);
    await expect(current(page)).toContainText(P1);
    await expect(current(page)).toContainText("Day 1 of 14");
    await expect(card(page, "Fitness and grooming")).toContainText(
      "Daily steps: 5,000 steps → 8,000 steps",
    );

    await current(page)
      .getByRole("button", { name: `Enable ${P2} early` })
      .click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("7 habits join your checklist from today");
    await expect(confirm).toContainText("You haven't reached 80% yet");
    await expect(confirm).toContainText("Daily steps: 5,000 steps → 8,000 steps");
    await confirm.getByRole("button", { name: "Enable" }).click();

    await expect(current(page)).toContainText(P2);
    await expect(card(page, "Foundation")).toContainText("Completed");
    await expect(page.getByTestId("phase-history")).toContainText(`${P2} started early`);
    await expect(page.getByTestId("phase-history")).toContainText(`${P1} completed`);

    await openToday(page);
    // A night habit: its group may start folded before the evening, so check it's on the list.
    await expect(habitRow(page, "Floss")).toBeAttached();
    await expect(habitRow(page, "Bath")).toBeVisible(); // Phase 1 stays on
    await expect(habitRow(page, "Daily steps")).toContainText("0 / 8,000 steps");
  });

  test("turning a phase off puts the old target back and removes its habits", async ({ page }) => {
    await openPhases(page);
    await current(page)
      .getByRole("button", { name: `Enable ${P2} early` })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Enable" }).click();
    await expect(current(page)).toContainText(P2);

    await current(page).getByRole("button", { name: "More phase actions" }).click();
    await page.getByRole("menuitem", { name: "Turn this phase off" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Turn off" }).click();
    await expect(current(page)).toContainText(P1);

    await openToday(page);
    await expect(habitRow(page, "Floss")).toHaveCount(0);
    await expect(habitRow(page, "Daily steps")).toContainText("0 / 5,000 steps");
  });

  test("pause and resume; repeat restarts the window", async ({ page }) => {
    await openPhases(page);
    await current(page).getByRole("button", { name: "Pause" }).click();
    await expect(current(page)).toContainText("Paused since");
    await expect(page.getByTestId("phase-message")).toContainText("Paused");

    await openToday(page);
    await expect(page.getByTestId("phase-tile")).toContainText("Phase paused");

    await openPhases(page);
    await current(page).getByRole("button", { name: "Resume" }).click();
    await expect(current(page)).toContainText("Active since");
    await current(page).getByRole("button", { name: "Repeat this phase" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Repeat" }).click();
    await expect(page.getByTestId("phase-history")).toContainText(`${P1} repeated`);
  });

  test("a locked phase can get a target change, shown on the habit's panel", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the habit panel opens in a dialog on phones; covered on laptop");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPhases(page);
    await card(page, "Sleep and mind").getByRole("button", { name: "Change a target" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Habit").selectOption({ label: "Daily steps" });
    await expect(dialog).toContainText("Now: 5,000 steps");
    await dialog.getByLabel(/New target/).fill("10000");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(card(page, "Sleep and mind")).toContainText(
      "Daily steps: 5,000 steps → 10,000 steps",
    );

    await page.goto("/habits");
    const phase1 = page.getByRole("region", { name: /Phase 1/ });
    await expect(phase1.getByTestId("phase-progress")).toContainText("Day 1 of 14");
    await phase1.getByRole("button", { name: /^Phase 1 · Foundation/ }).click();
    await phase1.getByRole("button", { name: /^Daily steps/ }).click();
    const detail = page.getByRole("region", { name: "Habit details" });
    await expect(detail.getByTestId("upcoming-target")).toHaveText([
      `becomes 8,000 steps in ${P2}`,
      `becomes 10,000 steps in ${P3}`,
    ]);
  });
});

test.describe("readiness on demo data", () => {
  test("a full window; with an easier rule Today says ready, and Phase 3 can be enabled", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Open demo data" }).click();
    await expect(page).toHaveURL(/\/$/);

    await openPhases(page);
    await expect(page.getByText(`${P2} · day 14 of 14`)).toBeVisible();
    await expect(page.getByTestId("phase-average")).toHaveText(/\d+%/);

    // Make the rule easy: 50% over 7 days, 5 logged days.
    await page.goto("/settings");
    await page.getByLabel("Average progress needed (%)").fill("50");
    await page.getByLabel("Window (days)").fill("7");
    await page.getByLabel("Logged days needed").fill("5");
    await page.getByRole("button", { name: "Save rule" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await openToday(page);
    await expect(page.getByText(`You're ready for ${P3}`)).toBeVisible();
    await expect(page.getByTestId("phase-tile")).toContainText(`Ready for ${P3}`);
    await page.getByRole("link", { name: "See phases" }).click();

    await expect(page.getByTestId("phase-message")).toContainText(`You're ready for ${P3}`);
    await current(page)
      .getByRole("button", { name: `Enable ${P3}` })
      .click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).not.toContainText("You haven't reached");
    await confirm.getByRole("button", { name: "Enable" }).click();
    await expect(current(page)).toContainText(P3);
    await expect(current(page)).toContainText("Day 1 of 7");
  });
});

test.describe("Phases layout on a laptop", () => {
  test.skip(({ isMobile }) => isMobile, "laptop only");

  test("current phase on the left, chart and rules on the right", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPhases(page);
    const main = (await current(page).boundingBox())!;
    const chart = (await page.getByRole("region", { name: "Daily completion" }).boundingBox())!;
    expect(chart.x).toBeGreaterThan(main.x + main.width - 10);
    expect(Math.abs(chart.y - main.y)).toBeLessThan(5);
  });
});
