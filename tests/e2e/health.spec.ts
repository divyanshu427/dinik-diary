import { expect, test, type Page } from "@playwright/test";

const issue = (page: Page, title: string) => page.locator(`[data-issue="${title}"]`);
const suggestion = (page: Page, kind: string) =>
  page.getByTestId("suggestions").locator(`[data-suggestion="${kind}"]`);
const stepsRow = (page: Page) => page.locator('[data-habit-row="Daily steps"]');

async function openHealth(page: Page) {
  await page.goto("/health");
  await expect(page.getByRole("heading", { level: 1, name: "Health" })).toBeVisible();
  await expect(page.getByText("Loading your health notes…")).toHaveCount(0);
}

/** Only what's wrong and how bad: the app works out the rest. */
async function addIssue(page: Page, title: string, level: number, note = "") {
  await openHealth(page);
  await page.getByRole("button", { name: "Add health issue" }).first().click();
  const d = page.getByRole("dialog");
  await d.getByLabel("What's going on?").fill(title);
  await d.getByRole("radio", { name: new RegExp(`^${level} –`) }).click();
  if (note) await d.getByLabel("Anything to add? (optional)").fill(note);
  return d;
}

async function save(page: Page, title: string) {
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Add", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(issue(page, title)).toBeVisible();
}

/** Yesterday's check-in, from the issue card. */
async function checkInYesterday(page: Page, title: string, level: number) {
  await issue(page, title).getByRole("button", { name: "Check in" }).click();
  const d = page.getByRole("dialog");
  const today = await d.getByLabel("Day").inputValue();
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  await d.getByLabel("Day").fill(y.toISOString().slice(0, 10));
  await d.getByRole("radio", { name: new RegExp(`^${level} –`) }).click();
  await d.getByRole("button", { name: "Save" }).click();
  await expect(d).toHaveCount(0);
}

test.describe("health", () => {
  test("I only say “knee pain, 7”: the app picks Daily steps, lightens it with my OK, and it goes back", async ({
    page,
  }) => {
    const d = await addIssue(page, "Knee pain", 7, "Twisted it on the stairs");
    // The form shows what the app understood, without me picking anything.
    await expect(d.getByTestId("understood")).toContainText("Recognised as knee or joint pain");
    await expect(d.getByTestId("understood")).toContainText("Daily steps");
    await save(page, "Knee pain");

    // One bad day isn't a pattern yet; a helpful habit is suggested straight away.
    await expect(suggestion(page, "change")).toHaveCount(0);
    await expect(suggestion(page, "add-helper")).toContainText("Gentle mobility exercises");

    await checkInYesterday(page, "Knee pain", 7);
    const steps = page.locator('[data-suggestion="change"][data-habit="Daily steps"]');
    await expect(steps).toContainText("Lighten Daily steps for 5 days: 5,000 steps → 2,500 steps");
    await expect(steps).toContainText("This often makes knee pain worse.");
    await expect(steps).toContainText("It goes back by itself afterwards.");

    await steps.getByRole("button", { name: "Yes, do it" }).click();
    await expect(page.getByTestId("running")).toContainText("Daily steps: 2,500 steps until");

    await page.goto("/");
    await expect(stepsRow(page)).toContainText("0 / 2,500 steps");

    await openHealth(page);
    await page.getByRole("button", { name: "End the change to Daily steps now" }).click();
    await expect(page.getByTestId("running")).toHaveCount(0);
    await page.goto("/");
    await expect(stepsRow(page)).toContainText("0 / 5,000 steps");
  });

  test("8 or more: see a doctor first, and no exercise ideas", async ({ page }) => {
    await addIssue(page, "Back pain", 5);
    await save(page, "Back pain");

    // Check in from Today.
    await page.goto("/");
    const card = page.locator('[data-check-in="Back pain"]');
    await card.getByRole("radio", { name: "9 – Severe" }).click();
    await expect(card).toContainText("Severe");
    await page.getByTestId("health-suggestions-link").click();

    await expect(suggestion(page, "see-doctor")).toContainText(
      "Back pain is at 9/10. Please see a doctor soon.",
    );
    await expect(suggestion(page, "add-helper")).toHaveCount(0);
    await suggestion(page, "sick-day").getByRole("button", { name: "Mark as Sick" }).click();
    await expect(suggestion(page, "sick-day")).toHaveCount(0);

    await page.goto("/");
    await expect(page.getByRole("radio", { name: "Sick" })).toHaveAttribute("aria-checked", "true");
  });

  test("an issue the app doesn't know is still tracked; notes show in Health", async ({ page }) => {
    const d = await addIssue(page, "Odd tingling", 3);
    await expect(d.getByTestId("understood")).toContainText("doesn't know this one yet");
    await save(page, "Odd tingling");

    await page.goto("/");
    const card = page.locator('[data-check-in="Odd tingling"]');
    await card.getByRole("button", { name: "Add a note" }).click();
    const note = card.getByLabel("Note for Odd tingling");
    await note.fill("Only in the left hand");
    await note.blur();
    const dayNote = page.getByLabel("Anything else about your health today?");
    await dayNote.fill("Slept badly");
    await dayNote.blur();

    await openHealth(page);
    const notes = page.getByTestId("health-notes");
    await expect(notes).toContainText("Only in the left hand");
    await expect(notes).toContainText("Slept badly");

    await issue(page, "Odd tingling")
      .getByRole("button", { name: "Actions for Odd tingling" })
      .click();
    await page.getByRole("menuitem", { name: "Mark as resolved" }).click();
    await expect(issue(page, "Odd tingling")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Resolved" })).toContainText("Odd tingling");
  });

  test("answered suggestions stay findable; no check-in today is pointed out", async ({ page }) => {
    await addIssue(page, "Knee pain", 7);
    await save(page, "Knee pain");

    // "Not now" hides it until the next check-in, but it can be brought back.
    await suggestion(page, "add-helper").getByRole("button", { name: "Not now" }).click();
    await expect(suggestion(page, "add-helper")).toHaveCount(0);
    const hidden = page.getByTestId("hidden-suggestions");
    await hidden.getByText("Hidden until your next check-in (1)").click();
    await expect(hidden).toContainText("Gentle mobility exercises");
    await hidden.getByRole("button", { name: "Show again" }).click();
    await expect(suggestion(page, "add-helper")).toBeVisible();

    // Without a check-in today, the plan asks for one first.
    await expect(page.getByTestId("check-in-reminder")).toHaveCount(0);
    const card = issue(page, "Knee pain");
    await card.getByText("Check-ins (1)").click();
    await card.getByRole("button", { name: /^Delete the check-in on/ }).click();
    const reminder = page.getByTestId("check-in-reminder");
    await expect(reminder).toContainText("Knee pain: no check-in today yet.");
    await reminder.getByRole("button", { name: "Check in" }).click();
    const d = page.getByRole("dialog");
    await d.getByRole("radio", { name: "8 – Severe" }).click();
    await d.getByRole("button", { name: "Save" }).click();
    await expect(reminder).toHaveCount(0);
    await expect(card.getByTestId("doctor-note")).toBeVisible();
    await expect(suggestion(page, "see-doctor")).toBeVisible();
  });

  test("check-in compares with last time; the tile opens a check-in", async ({ page }) => {
    await addIssue(page, "Eye strain", 5);
    await save(page, "Eye strain");
    await checkInYesterday(page, "Eye strain", 5);

    await page.getByTestId("health-tiles").getByRole("button", { name: "Check in again" }).click();
    const d = page.getByRole("dialog");
    await expect(d.getByRole("heading", { name: "Eye strain" })).toBeVisible();
    await d.getByRole("radio", { name: /^5 –/ }).click();
    await expect(d.getByTestId("check-in-summary")).toHaveText(
      "5 · Moderate. Same as your last check-in.",
    );
    await d.getByRole("radio", { name: /^3 –/ }).click();
    await expect(d.getByTestId("check-in-summary")).toContainText("2 better than your last");
    await d.getByRole("button", { name: "Save check-in" }).click();
    await expect(d).toHaveCount(0);
    await expect(issue(page, "Eye strain").getByTestId("issue-latest")).toHaveText("3/10");
  });

  test("the old Concerns link opens Health", async ({ page }) => {
    await page.goto("/concerns");
    await expect(page).toHaveURL(/\/health$/);
    await expect(page.getByRole("heading", { level: 1, name: "Health" })).toBeVisible();
  });
});
