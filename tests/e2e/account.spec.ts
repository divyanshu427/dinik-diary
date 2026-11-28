import { expect, test } from "@playwright/test";

test.describe("settings: account and sync", () => {
  test("signing in sends an email with a link, and can send it again", async ({ page }) => {
    // Never send a real email from a test: the sign-in request is answered here.
    let sentTo = "";
    await page.route("**/auth/v1/otp**", async (route) => {
      sentTo = JSON.parse(route.request().postData() ?? "{}").email ?? "";
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/settings");
    const card = page.getByRole("region", { name: "Account and sync" });
    await expect(card).toContainText("Only you can see your data.");
    const send = card.getByRole("button", { name: "Send sign-in email" });
    await expect(send).toBeDisabled();

    await card.getByLabel("Email").fill("someone@example.com");
    await send.click();
    await expect(card.getByRole("status")).toContainText("Check someone@example.com");
    expect(sentTo).toBe("someone@example.com");

    await card.getByRole("button", { name: "Send again" }).click();
    await expect(card.getByRole("button", { name: "Send again" })).toBeEnabled();
    await card.getByRole("button", { name: "Use a different email" }).click();
    await expect(card.getByLabel("Email")).toBeVisible();
  });

  test("a sign-in error is shown, and the data stays on this device", async ({ page }) => {
    await page.route("**/auth/v1/otp**", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ code: 429, msg: "Email rate limit exceeded" }),
      }),
    );
    await page.goto("/settings");
    const card = page.getByRole("region", { name: "Account and sync" });
    await card.getByLabel("Email").fill("someone@example.com");
    await card.getByRole("button", { name: "Send sign-in email" }).click();
    await expect(card.getByRole("alert")).toContainText("Too many sign-in emails");
  });
});
