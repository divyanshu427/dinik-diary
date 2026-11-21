import { expect, test } from "@playwright/test";

test.describe("installable app", () => {
  test("manifest and icons come from the brand settings", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({
      name: "Dinik Diary",
      short_name: "Dinik",
      display: "standalone",
      start_url: "/",
    });
    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
    }
    const sw = await request.get("/sw.js");
    expect(sw.headers()["cache-control"]).toContain("no-cache");
  });

  test("after the first visit, every screen opens offline with my data", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Checklist" })).toBeVisible();
    // Tick something, so there's my own data to see offline.
    await page.getByRole("checkbox", { name: "Bath", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Bath", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect(page.getByTestId("offline-status")).toHaveCount(0); // not on this page
    await page.goto("/settings");
    await expect(page.getByTestId("offline-status")).toHaveText("Works offline on this device.");

    await context.setOffline(true);
    for (const [route, heading] of [
      ["/", "Today"],
      ["/habits", "Habits"],
      ["/health/reports", "Reports and values"],
      ["/reports", "Reports"],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
    await page.goto("/");
    await expect(page.getByRole("checkbox", { name: "Bath", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await context.setOffline(false);
  });
});
