import { expect, test, type Page } from "@playwright/test";

const numbers = (page: Page) => page.getByRole("region", { name: "Your numbers" });
const timeline = (page: Page) => page.getByRole("region", { name: "Your day" });
const dialog = (page: Page) => page.getByRole("dialog");

async function openToday(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Checklist" })).toBeVisible();
  await expect(numbers(page).getByLabel("Woke up")).toBeVisible();
}

/** Types into a numbers-panel box and leaves it (that's when it saves). */
async function enter(page: Page, label: string, value: string) {
  const input = numbers(page).getByLabel(label, { exact: true });
  await input.fill(value);
  await input.blur();
}

async function logTimed(page: Page, title: string, category: string, start: string, end: string) {
  await page
    .getByRole("region", { name: "Your day" })
    .getByRole("button", { name: "Log activity" })
    .click();
  const d = dialog(page);
  await d.getByLabel("What did you do?").fill(title);
  await d.getByLabel("Category", { exact: true }).selectOption({ label: category });
  await d.getByLabel("Start").fill(start);
  await d.getByLabel("End").fill(end);
  await d.getByRole("button", { name: "Log activity" }).click();
  await expect(dialog(page)).toHaveCount(0);
}

test.describe("metrics and timeline", () => {
  test("bed 23:30 / wake 07:30 → an 8 h sleep block", async ({ page }) => {
    await openToday(page);
    await enter(page, "Went to bed", "23:30");
    await enter(page, "Woke up", "07:30");
    await expect(numbers(page).getByTestId("sleep-result")).toHaveText("8 h of sleep");

    const sleep = timeline(page).locator('[data-timeline="sleep"]');
    await expect(sleep).toContainText("11:30 PM – 7:30 AM");
    await expect(sleep).toContainText("8 h");

    // Woke at 7:30 against a 7:30 target: the wake-up habit ticks itself.
    await expect(
      page
        .locator('[data-habit-row="Wake up on time"]')
        .getByRole("img", { name: "Done", exact: true }),
    ).toBeVisible();

    await page.reload();
    await expect(numbers(page).getByTestId("sleep-result")).toHaveText("8 h of sleep");
  });

  test("steps typed in the numbers panel count for the Daily steps habit", async ({ page }) => {
    await openToday(page);
    await enter(page, "Steps", "3420");
    const steps = page.locator('[data-habit-row="Daily steps"]');
    await expect(steps).toContainText("3,420 / 5,000 steps");

    // And the other way round: the habit's quick add updates the number.
    await steps.getByRole("button", { name: "Add 1,000 to Daily steps" }).click();
    await expect(numbers(page).getByLabel("Steps", { exact: true })).toHaveValue("4420");
  });

  test("a 3-hour gap shows the prompt, and Fill the gap closes it", async ({ page }) => {
    await openToday(page);
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Yesterday" })).toBeVisible();

    await enter(page, "Woke up", "07:00");
    await logTimed(page, "Job applications", "Work and job search", "07:00", "14:00");
    await logTimed(page, "Visited the fort", "Travel and exploration", "17:00", "23:30");

    const prompt = timeline(page).getByText("Nothing logged between 2:00 PM and 5:00 PM");
    await expect(prompt).toBeVisible();
    await expect(timeline(page).locator('[data-timeline="gap"]')).toHaveCount(1);

    await timeline(page).getByRole("button", { name: "Fill the gap", exact: true }).click();
    const d = dialog(page);
    await expect(d.getByLabel("Start")).toHaveValue("14:00");
    await expect(d.getByLabel("End")).toHaveValue("17:00");
    await d.getByLabel("What did you do?").fill("Lunch and rest");
    await d.getByLabel("Category", { exact: true }).selectOption({ label: "Sleep and rest" });
    await d.getByRole("button", { name: "Log activity" }).click();

    await expect(prompt).toHaveCount(0);
    await expect(timeline(page).locator('[data-timeline="gap"]')).toHaveCount(0);
    await expect(timeline(page).locator('[data-title="Lunch and rest"]')).toContainText("3 h");
  });

  test("overlapping entries: the warning's Fix splits the longer one", async ({ page }) => {
    await openToday(page);
    await page.getByRole("button", { name: "Previous day" }).click();
    await logTimed(page, "Work", "Work and job search", "09:00", "17:00");
    await logTimed(page, "Lunch", "Meals and food", "13:00", "14:00");

    const warning = timeline(page).getByText("Work and Lunch overlap (1:00 PM – 2:00 PM)");
    await expect(warning).toBeVisible();
    await timeline(page)
      .getByRole("button", { name: /^Fix: Work and Lunch/ })
      .click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText(
      "Work is split in two: 9:00 AM – 1:00 PM and 2:00 PM – 5:00 PM.",
    );
    await confirm.getByRole("button", { name: "Fix overlap" }).click();

    await expect(warning).toHaveCount(0);
    const work = timeline(page).locator('[data-title="Work"]');
    await expect(work).toHaveCount(2);
    await expect(work.first()).toContainText("9:00 AM – 1:00 PM");
    await expect(work.last()).toContainText("2:00 PM – 5:00 PM");
  });
});

test.describe("Today layout on a laptop", () => {
  test.skip(({ isMobile }) => isMobile, "laptop only");

  test("numbers and timeline sit side by side", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openToday(page);
    const left = (await numbers(page).boundingBox())!;
    const right = (await timeline(page).boundingBox())!;
    expect(right.x).toBeGreaterThan(left.x + left.width - 10);
    expect(Math.abs(right.y - left.y)).toBeLessThan(5);
  });
});
