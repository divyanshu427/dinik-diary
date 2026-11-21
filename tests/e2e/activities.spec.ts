import { expect, test, type Page } from "@playwright/test";

const dialog = (page: Page) => page.getByRole("dialog");
const entry = (page: Page, title: string) => page.locator(`[data-activity="${title}"]`);
const chips = (page: Page) => page.getByRole("group", { name: "Filter activities" });

async function logActivity(
  page: Page,
  fields: {
    title: string;
    category: string;
    start?: string;
    end?: string;
    duration?: string;
    place?: string;
  },
) {
  const d = dialog(page);
  await d.getByLabel("What did you do?").fill(fields.title);
  await d.getByLabel("Category", { exact: true }).selectOption({ label: fields.category });
  if (fields.start) await d.getByLabel("Start").fill(fields.start);
  if (fields.end) await d.getByLabel("End").fill(fields.end);
  if (fields.duration) await d.getByLabel("Duration (min)").fill(fields.duration);
  if (fields.place) await d.getByLabel("Place").fill(fields.place);
  await d.getByRole("button", { name: "Log activity" }).click();
  await expect(dialog(page)).toHaveCount(0);
}

async function openActivities(page: Page) {
  await page.goto("/activities");
  await expect(page.getByRole("heading", { level: 1, name: "Activities" })).toBeVisible();
  await expect(page.getByText("Loading activities…")).toHaveCount(0);
}

test.describe("activities", () => {
  test("log 'Visited the fort'; it shows in the list, under the filter and on Today", async ({
    page,
  }) => {
    await openActivities(page);
    await page.getByRole("button", { name: "Log activity" }).first().click();
    await logActivity(page, {
      title: "Visited the fort",
      category: "Travel and exploration",
      start: "17:00",
      end: "19:00",
      place: "Fort",
    });
    await page.getByRole("button", { name: "Log activity" }).first().click();
    await logActivity(page, {
      title: "Interview",
      category: "Work and job search",
      duration: "30",
    });

    const fort = entry(page, "Visited the fort");
    await expect(fort).toContainText("Travel and exploration · Fort");
    await expect(fort).toContainText("2 h");
    await expect(page.getByText("This period: 2 entries, 2 h 30 min logged")).toBeVisible();

    await chips(page).getByRole("button", { name: "Travel" }).click();
    await expect(fort).toBeVisible();
    await expect(entry(page, "Interview")).toHaveCount(0);
    await chips(page).getByRole("button", { name: "Work" }).click();
    await expect(fort).toHaveCount(0);
    await expect(entry(page, "Interview")).toBeVisible();

    await page.goto("/");
    const panel = page.getByRole("region", { name: "What you did today" });
    await expect(panel.locator('[data-activity="Visited the fort"]')).toContainText("5:00 PM");
    await expect(panel.locator('[data-activity="Interview"]')).toContainText("30 min");
  });

  test("log from Today without a duration: it's flagged", async ({ page }) => {
    await page.goto("/");
    const panel = page.getByRole("region", { name: "What you did today" });
    await panel.getByRole("button", { name: "Log activity" }).click();
    await logActivity(page, { title: "Watched a movie", category: "Entertainment" });
    await expect(panel.locator('[data-activity="Watched a movie"]')).toContainText("duration?");
  });

  test("edit and delete an activity", async ({ page }) => {
    await openActivities(page);
    await page.getByRole("button", { name: "Log activity" }).first().click();
    await logActivity(page, { title: "Gym", category: "Fitness and exercise", duration: "40" });

    await entry(page, "Gym").getByRole("button", { name: /^Gym/ }).click();
    await expect(dialog(page)).toContainText("Edit activity");
    await dialog(page).getByLabel("Duration (min)").fill("60");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(entry(page, "Gym")).toContainText("1 h");

    await entry(page, "Gym").getByRole("button", { name: "Actions for Gym" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(entry(page, "Gym")).toHaveCount(0);
  });

  test("repeat yesterday's activities on today", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Previous day" }).click();
    const panel = page.getByRole("region", { name: "What you did" });
    await panel.getByRole("button", { name: "Log activity" }).click();
    await logActivity(page, {
      title: "Job applications",
      category: "Work and job search",
      duration: "60",
    });
    await expect(panel.locator('[data-activity="Job applications"]')).toBeVisible();

    await page.getByRole("button", { name: "Back to today" }).click();
    const today = page.getByRole("region", { name: "What you did today" });
    await today.getByRole("button", { name: "Repeat yesterday (1)" }).click();
    await expect(today.locator('[data-activity="Job applications"]')).toContainText("1 h");
  });

  test("add a category and merge it into another", async ({ page }) => {
    await openActivities(page);
    const cats = page.getByRole("region", { name: "Categories" });
    await cats.getByRole("button", { name: "Add category" }).click();
    await dialog(page).getByLabel("Name").fill("Volunteering");
    await dialog(page).getByRole("radio", { name: "Theme colour 8" }).click();
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(cats.locator('[data-category="Volunteering"]')).toBeVisible();

    await page.getByRole("button", { name: "Log activity" }).first().click();
    await logActivity(page, { title: "Beach clean-up", category: "Volunteering", duration: "90" });
    await expect(entry(page, "Beach clean-up")).toContainText("Volunteering");

    await cats.getByRole("button", { name: "Actions for Volunteering" }).click();
    await page.getByRole("menuitem", { name: "Merge into…" }).click();
    await dialog(page).getByLabel("Merge into").selectOption({ label: "Social and family" });
    await dialog(page).getByRole("button", { name: "Merge" }).click();
    await expect(cats.locator('[data-category="Volunteering"]')).toHaveCount(0);
    await expect(entry(page, "Beach clean-up")).toContainText("Social and family");
  });
});

test.describe("activities layout on a laptop", () => {
  test.skip(({ isMobile }) => isMobile, "laptop only");

  test("list and side column sit side by side", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openActivities(page);
    await page.getByRole("button", { name: "Log activity" }).first().click();
    await logActivity(page, { title: "Walk", category: "Fitness and exercise", duration: "30" });
    const list = (await entry(page, "Walk").boundingBox())!;
    const side = (await page
      .getByRole("heading", { level: 2, name: "Time by category" })
      .boundingBox())!;
    expect(side.x).toBeGreaterThan(list.x + list.width - 60);
  });
});
