import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const count = (page: Page, table: string) => page.getByTestId(`count-${table}`);

async function expectStarterCounts(page: Page) {
  await expect(count(page, "phases")).toHaveText("5");
  await expect(count(page, "habits")).toHaveText("40");
  await expect(count(page, "categories")).toHaveText("15");
}

test.describe("data layer on the Settings screen", () => {
  test("shows the starter data on first visit", async ({ page }) => {
    await page.goto("/settings");
    await expectStarterCounts(page);

    await page.getByText("Phase 1 · Foundation").click();
    await expect(page.getByText("Brush teeth — morning")).toBeVisible();
    await expect(page.getByText("Brush teeth — night")).toBeVisible();
  });

  test("download a backup, reset, then restore it", async ({ page }) => {
    await page.goto("/settings");
    await expectStarterCounts(page);
    await page.getByRole("radio", { name: /Mono/ }).click();

    // 1. Download
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download backup" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^dinik-diary-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const backup = JSON.parse(await readFile(path, "utf8"));
    expect(backup.app).toBe("dinik-diary");
    expect(backup.data.habits).toHaveLength(40);
    expect(backup.data.settings.themePreset).toBe("mono");
    await expect(page.getByRole("status")).toContainText("Saved dinik-diary-backup-");

    // 2. Reset (asks first)
    await page.getByRole("button", { name: "Reset to starter data" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Reset to the starter data?");
    await page.getByRole("button", { name: "Delete and reset" }).click();
    await expect(page.getByRole("status")).toHaveText("Starter data loaded.");
    await expectStarterCounts(page);
    await page.getByRole("radio", { name: /Sage/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sage");

    // 3. Restore (asks first) — brings back the backup's theme too
    await page.getByTestId("backup-file-input").setInputFiles(path);
    await expect(page.getByRole("alertdialog")).toContainText("Replace all data with this backup?");
    await page.getByRole("button", { name: "Replace all data" }).click();
    await expect(page.getByRole("status")).toHaveText("Backup restored.");
    await expectStarterCounts(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "mono");
  });

  test("a broken file is rejected and nothing changes", async ({ page }) => {
    await page.goto("/settings");
    await expectStarterCounts(page);

    await page.getByTestId("backup-file-input").setInputFiles({
      name: "not-a-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"app":"something-else"}'),
    });
    const error = page.getByRole("alert").filter({ hasText: "This file can't be restored" });
    await expect(error).toContainText("This isn't a Dinik Diary backup file.");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expectStarterCounts(page);
  });

  test("the theme is saved with the data, not only in the browser cache", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/settings");
    await expectStarterCounts(page);
    await page.getByRole("radio", { name: /Mono/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "mono");

    // Wait until the choice is saved in the database (a person never clears storage this fast).
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<string | undefined>((resolve) => {
              const open = indexedDB.open("dinik-diary");
              open.onsuccess = () => {
                const get = open.result
                  .transaction("settings")
                  .objectStore("settings")
                  .get("settings");
                get.onsuccess = () => resolve(get.result?.themePreset);
              };
            }),
        ),
      )
      .toBe("mono");

    // Wipe the quick-load copy; the database should bring the theme back.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "mono");
  });
});
