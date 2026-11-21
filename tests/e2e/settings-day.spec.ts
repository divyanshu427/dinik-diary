import { expect, test } from "@playwright/test";

test.describe("settings: day, time, units and backups", () => {
  test("day start, week start, time zone and units are saved and used", async ({ page }) => {
    await page.goto("/settings");
    const card = page.getByRole("region", { name: "Day, time and units" });
    await card.getByLabel("My day starts at").selectOption({ label: "6 AM" });
    await card.getByRole("radio", { name: "Sunday" }).click();
    await card.getByRole("radio", { name: "Imperial (lb)" }).click();
    await card.getByLabel("Time zone").fill("Not/A_Zone");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("alert")).toContainText("isn't a time zone");

    await card.getByLabel("Time zone").fill("Europe/London");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(card.getByLabel("My day starts at")).toHaveValue("6");
    await expect(card.getByLabel("Time zone")).toHaveValue("Europe/London");
    await expect(card.getByRole("radio", { name: "Sunday" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.goto("/");
    await expect(page.getByRole("region", { name: "Your day" })).toContainText(
      "Day runs from 6:00 AM",
    );
    await expect(page.getByRole("region", { name: "Your numbers" })).toContainText("lb");
  });

  test("after 10 days without a backup, Today reminds me; downloading clears it", async ({
    page,
  }) => {
    await page.goto("/"); // the data starts today
    await expect(page.getByRole("heading", { level: 2, name: "Checklist" })).toBeVisible();
    await expect(page.getByTestId("backup-reminder")).toHaveCount(0);

    // Ten days later.
    await page.clock.install({ time: new Date(Date.now() + 10 * 86_400_000) });
    await page.reload();
    const reminder = page.getByTestId("backup-reminder");
    await expect(reminder).toContainText("You haven't downloaded a backup yet");

    // "Remind me tomorrow" hides it until then.
    await reminder.getByRole("button", { name: "Remind me tomorrow" }).click();
    await expect(reminder).toHaveCount(0);
    await page.evaluate(() => localStorage.removeItem("dinik-diary:backup-snooze"));
    await page.reload();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("backup-reminder").getByRole("button", { name: "Download backup" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^dinik-diary-backup-\d{4}-\d{2}-\d{2}\.json$/);
    await expect(page.getByText(/Keep it somewhere safe/)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("backup-reminder")).toHaveCount(0);

    await page.goto("/settings");
    await expect(page.getByTestId("last-backup")).toHaveText("Last backup: today.");
  });
});
