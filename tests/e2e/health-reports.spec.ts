import { expect, test, type Page } from "@playwright/test";

// A 1×1 PNG and a tiny PDF, as uploads.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF", "utf8");

const report = (page: Page, title: string) => page.locator(`[data-report="${title}"]`);
const value = (page: Page, name: string) =>
  page.getByTestId("value-list").locator(`[data-value="${name}"]`);

async function openReports(page: Page) {
  await page.goto("/health/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reports and values" })).toBeVisible();
  await expect(page.getByText("Loading your reports…")).toHaveCount(0);
}

/** A date `days` before the one in a date field. */
async function daysBefore(page: Page, label: string, days: number) {
  const field = page.getByRole("dialog").getByLabel(label, { exact: true });
  const d = new Date(`${await field.inputValue()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  await field.fill(d.toISOString().slice(0, 10));
}

test.describe("health reports", () => {
  test("add a report with a photo, a PDF and values; low values stand out", async ({ page }) => {
    await openReports(page);
    await page.getByRole("button", { name: "Add report" }).first().click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Title").fill("Thyroid and vitamin test");
    await daysBefore(page, "Date", 30);
    await d.getByLabel("Doctor or lab (optional)").fill("City Lab");
    await d.getByLabel("Choose files").setInputFiles([
      { name: "page-1.png", mimeType: "image/png", buffer: PNG },
      { name: "full-report.pdf", mimeType: "application/pdf", buffer: PDF },
    ]);
    await expect(d.getByTestId("report-files")).toContainText("page-1.png");
    await expect(d.getByTestId("report-files")).toContainText("full-report.pdf");

    await d.getByLabel("Name", { exact: true }).fill("Vitamin D");
    await d.getByLabel("Value", { exact: true }).fill("18");
    await d.getByLabel("Unit").fill("ng/mL");
    await d.getByLabel("Normal from").fill("30");
    await d.getByLabel("Normal to").fill("100");
    await d.getByRole("button", { name: "Add a value" }).click();
    await d.locator("#v-name-1").fill("TSH");
    await d.locator("#v-value-1").fill("2.1");
    await d.locator("#v-unit-1").fill("mIU/L");
    await d.locator("#v-low-1").fill("0.4");
    await d.locator("#v-high-1").fill("4");
    await d.getByRole("button", { name: "Add report" }).click();
    await expect(d).toHaveCount(0);

    const row = report(page, "Thyroid and vitamin test");
    await expect(row).toContainText("Blood test");
    await expect(row).toContainText("City Lab");
    await expect(row.getByTestId("report-values")).toContainText("Vitamin D: 18 ng/mL · Low");
    await expect(row.getByTestId("report-values")).toContainText("TSH: 2.1 mIU/L");
    await expect(value(page, "Vitamin D")).toContainText("Low");
    await expect(value(page, "TSH")).toContainText("Normal");
    await expect(page.getByTestId("report-health-tiles")).toContainText("Out of range1Vitamin D");

    // Files open in a new tab (the photo here: headless Chrome has no PDF viewer).
    await expect(row.getByRole("button", { name: "Open full-report.pdf" })).toBeVisible();
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      row.getByRole("button", { name: "Open page-1.png" }).click(),
    ]);
    await popup.waitForLoadState();
    await expect.poll(() => popup.url()).toMatch(/^blob:/);
    await popup.close();

    // The overview points out the low value.
    await page.getByRole("link", { name: "Overview" }).click();
    await expect(page.getByTestId("out-of-range")).toContainText("Vitamin D: 18 ng/mL (low)");
  });

  test("a second report fills in the unit and range from history and shows the trend", async ({
    page,
  }) => {
    await openReports(page);
    for (const [title, days, level] of [
      ["Vitamin test (Aug)", 90, "14"],
      ["Vitamin test (Nov)", 5, "26"],
    ] as const) {
      await page.getByRole("button", { name: "Add report" }).first().click();
      const d = page.getByRole("dialog");
      await d.getByLabel("Title").fill(title);
      await daysBefore(page, "Date", days);
      await d.getByLabel("Name", { exact: true }).fill("Vitamin D");
      await d.getByLabel("Name", { exact: true }).blur();
      if (title.includes("Aug")) {
        await d.getByLabel("Unit").fill("ng/mL");
        await d.getByLabel("Normal from").fill("30");
        await d.getByLabel("Normal to").fill("100");
      } else {
        // Filled in from the August report.
        await expect(d.getByLabel("Unit")).toHaveValue("ng/mL");
        await expect(d.getByLabel("Normal from")).toHaveValue("30");
      }
      await d.getByLabel("Value", { exact: true }).fill(level);
      await d.getByRole("button", { name: "Add report" }).click();
      await expect(d).toHaveCount(0);
    }
    await expect(value(page, "Vitamin D")).toContainText("+12 since last time");
    await expect(page.locator(".recharts-line-curve")).toBeVisible();

    // A value measured at home, and deleting it again.
    await page.getByRole("button", { name: "Add a value" }).click();
    const v = page.getByRole("dialog");
    await v.getByLabel("Name", { exact: true }).fill("Blood pressure (top)");
    await v.getByLabel("Value", { exact: true }).fill("132");
    await v.getByLabel("Unit").fill("mmHg");
    await v.getByLabel("Normal to").fill("120");
    await v.getByRole("button", { name: "Save" }).click();
    const bp = value(page, "Blood pressure (top)");
    await expect(bp).toContainText("High");
    await bp.getByText("History (1)").click();
    await bp.getByRole("button", { name: /^Delete Blood pressure \(top\) on/ }).click();
    await expect(bp).toHaveCount(0);

    // Deleting a report deletes its values.
    await report(page, "Vitamin test (Nov)")
      .getByRole("button", { name: "Actions for Vitamin test (Nov)" })
      .click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(report(page, "Vitamin test (Nov)")).toHaveCount(0);
    await expect(value(page, "Vitamin D")).toContainText("14");
  });

  test("files that aren't photos or PDFs, or are too big, are refused", async ({ page }) => {
    await openReports(page);
    await page.getByRole("button", { name: "Add report" }).first().click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Choose files").setInputFiles([
      { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") },
      { name: "huge.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) },
    ]);
    await expect(d.getByRole("alert")).toContainText("“notes.txt” isn't a photo or a PDF.");
    await expect(d.getByRole("alert")).toContainText("“huge.pdf” is larger than 10 MB.");
    await expect(d.getByTestId("report-files")).toHaveCount(0);
  });
});
