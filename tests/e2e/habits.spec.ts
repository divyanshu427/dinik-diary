import { expect, test, type Locator, type Page } from "@playwright/test";

const P1 = "Phase 1 · Foundation";
const P2 = "Phase 2 · Fitness and grooming";
const P3 = "Phase 3 · Sleep and mind";

const phase = (page: Page, name: string) => page.getByRole("region", { name });
const toggle = (page: Page, name: string) =>
  phase(page, name).locator('button[aria-controls^="phase-list-"]');
const dialog = (page: Page) => page.getByRole("dialog");
const habitNames = (page: Page, name: string) => phase(page, name).locator("[data-habit-name]");

async function openHabits(page: Page, ...expand: string[]) {
  await page.goto("/habits");
  await expect(phase(page, P1)).toBeVisible();
  for (const name of expand) await expandPhase(page, name);
}

async function expandPhase(page: Page, name: string) {
  if ((await toggle(page, name).getAttribute("aria-expanded")) !== "true")
    await toggle(page, name).click();
  await expect(toggle(page, name)).toHaveAttribute("aria-expanded", "true");
}

/**
 * Opens a habit's ⋯ menu and picks an item (and then a sub-item, e.g. "Reorder" → "Move down").
 * A laptop submenu also opens on hover, so a click can close it again: if the last item never
 * gets clicked, the menu is closed and the whole path is tried again (nothing was chosen yet).
 */
async function habitAction(page: Page, habit: string, ...path: string[]) {
  await expect(async () => {
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: `Actions for ${habit}` }).click({ timeout: 3000 });
    for (const action of path)
      await page.getByRole("menuitem", { name: action }).click({ timeout: 3000 });
  }).toPass();
}

/** Phones show drag handles only after "Reorder habits" in the phase's menu. */
async function showHandles(page: Page, isMobile: boolean, phaseName: string) {
  if (!isMobile) return;
  await page.getByRole("button", { name: `Actions for phase ${phaseName}` }).click();
  await page.getByRole("menuitem", { name: "Reorder habits" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(handle(page, "Bath").or(handle(page, "Workout or yoga")).first()).toBeVisible();
}

/** Drags with real pointer moves (dnd-kit needs movement to start a drag). */
async function drag(page: Page, from: Locator, to: Locator, where: "top" | "middle" = "middle") {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = where === "top" ? b.y + 6 : b.y + b.height / 2;
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(ax, ay + 8, { steps: 4 });
  await page.mouse.move(bx, by, { steps: 25 });
  await page.mouse.move(bx, by + 2, { steps: 3 });
  await page.mouse.up();
  // Wait for the drop animation to finish before doing anything else.
  await expect(page.getByTestId("drag-preview")).toHaveCount(0);
}

const handle = (page: Page, habit: string) =>
  page.getByRole("button", { name: `Drag to move ${habit}` });

test.describe("habits and phases editor", () => {
  test("phases start collapsed, open on click, and stay open after reload", async ({ page }) => {
    await openHabits(page);
    await expect(toggle(page, P1)).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Brush teeth — morning")).toHaveCount(0);

    await toggle(page, P1).click();
    await expect(phase(page, P1).getByText("Brush teeth — morning")).toBeVisible();

    await page.reload();
    await expect(phase(page, P1).getByText("Brush teeth — morning")).toBeVisible();
    await expect(toggle(page, P2)).toHaveAttribute("aria-expanded", "false");

    await toggle(page, P1).click();
    await expect(page.getByText("Brush teeth — morning")).toHaveCount(0);
  });

  test("create Lunch in Phase 2, move it to Phase 1, archive and restore it", async ({ page }) => {
    await openHabits(page);

    // Create (the form may put habits in any phase, even a locked one you're planning)
    await page.getByRole("button", { name: "Add habit", exact: true }).first().click();
    await dialog(page).getByLabel("Name").fill("Lunch");
    await dialog(page).getByLabel("Phase").selectOption({ label: P2 });
    await dialog(page).getByRole("button", { name: "Add habit" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(phase(page, P2).getByText("Lunch", { exact: true })).toBeVisible(); // opened for you

    // Move: locked phases are greyed out in the menu, unlocked ones work
    await page.getByRole("button", { name: "Actions for Lunch" }).click();
    await page.getByRole("menuitem", { name: "Move to another phase" }).click();
    await expect(page.getByRole("menuitem", { name: new RegExp(P3) })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.getByRole("menuitem", { name: P1 }).click();
    await expect(phase(page, P1).getByText("Lunch", { exact: true })).toBeVisible();
    await expect(phase(page, P2).getByText("Lunch", { exact: true })).toHaveCount(0);

    // Archive and restore
    await habitAction(page, "Lunch", "Archive");
    await expect(phase(page, P1).getByText("Lunch", { exact: true })).toHaveCount(0);
    await page.getByText("Archived habits (1)").click();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(phase(page, P1).getByText("Lunch", { exact: true })).toBeVisible();

    await page.reload();
    await expect(phase(page, P1).getByText("Lunch", { exact: true })).toBeVisible();
  });

  test.describe("drag and drop", () => {
    test.beforeEach(async ({ page }) => {
      // Tall window so source and target are both on screen without scrolling.
      const width = page.viewportSize()!.width;
      await page.setViewportSize({ width, height: 2600 });
    });

    test("drag a habit to a new position within its phase", async ({ page, isMobile }) => {
      await openHabits(page, P1);
      await showHandles(page, isMobile, "Foundation");
      await expect(habitNames(page, P1).first()).toHaveText("Wake up on time");
      await drag(page, handle(page, "Bath"), phase(page, P1).getByRole("listitem").first(), "top");
      await expect(habitNames(page, P1).first()).toHaveText("Bath");
      await page.reload();
      await expect(habitNames(page, P1).first()).toHaveText("Bath");
    });

    test("drag a habit from Phase 2 into unlocked Phase 1", async ({ page, isMobile }) => {
      await openHabits(page, P2); // Phase 1 stays collapsed: dropping on it adds to the end
      await showHandles(page, isMobile, "Fitness and grooming");
      await drag(page, handle(page, "Workout or yoga"), toggle(page, P1));
      await expect(toggle(page, P1)).toHaveAttribute("aria-expanded", "true");
      await expect(habitNames(page, P1).last()).toHaveText("Workout or yoga");
      await expect(phase(page, P2).getByText("Workout or yoga")).toHaveCount(0);
    });

    test("dropping into a locked phase is refused", async ({ page, isMobile }) => {
      await openHabits(page, P2);
      await showHandles(page, isMobile, "Fitness and grooming");
      await drag(page, handle(page, "Workout or yoga"), toggle(page, P3));
      await expect(page.getByRole("alert").filter({ hasText: "is locked" })).toContainText(
        `${P3} is locked. Habits can only be moved into unlocked phases.`,
      );
      await expect(phase(page, P2).getByText("Workout or yoga")).toBeVisible();
      await expandPhase(page, P3);
      await expect(phase(page, P3).getByText("Workout or yoga")).toHaveCount(0);
    });

    test("move a habit with the keyboard", async ({ page, isMobile }) => {
      await openHabits(page, P1);
      await showHandles(page, isMobile, "Foundation");
      await handle(page, "Bath").focus();
      // Screen-reader announcements say where the habit is; wait for each one like a
      // screen-reader user would, instead of guessing delays.
      const announced = page.locator('[id^="DndLiveRegion"]');
      await page.keyboard.press("Space");
      await expect(announced).toHaveText(/Bath is at position 5 of 11/); // picked up
      // dnd-kit starts listening for arrow keys a few ms after pick-up; no person is that fast.
      await page.waitForTimeout(100);
      for (const position of [4, 3, 2, 1]) {
        await page.keyboard.press("ArrowUp");
        await expect(announced).toHaveText(new RegExp(`Bath is at position ${position} of 11`));
      }
      await page.keyboard.press("Space");
      await expect(page.getByTestId("drag-preview")).toHaveCount(0);
      await expect(habitNames(page, P1).first()).toHaveText("Bath");
    });
  });

  test("delete a habit after confirming", async ({ page }) => {
    await openHabits(page, P1);
    await habitAction(page, "Bath", "Delete habit");
    await expect(page.getByRole("alertdialog")).toContainText("Delete “Bath”?");
    await page.getByRole("button", { name: "Delete habit" }).click();
    await expect(phase(page, P1).getByText("Bath", { exact: true })).toHaveCount(0);
  });

  test("edit a target: 5,000 → 8,000 steps", async ({ page }) => {
    await openHabits(page, P1);
    await expect(phase(page, P1).getByText(/^5,000 steps · Fitness/)).toBeVisible();
    await habitAction(page, "Daily steps", "Edit");
    await expect(dialog(page)).toContainText("Past days keep the old target.");
    await dialog(page).getByLabel("Target", { exact: true }).fill("8000");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(phase(page, P1).getByText(/^8,000 steps · Fitness/)).toBeVisible();
  });

  test("shows a clear error for a missing name", async ({ page }) => {
    await openHabits(page);
    await page.getByRole("button", { name: "Add habit", exact: true }).first().click();
    await dialog(page).getByRole("button", { name: "Add habit" }).click();
    await expect(dialog(page)).toContainText("Give the habit a name.");
  });

  test("shows only the fields each kind of habit needs", async ({ page }) => {
    await openHabits(page);
    await page.getByRole("button", { name: "Add habit", exact: true }).first().click();
    const d = dialog(page);
    await expect(d.getByLabel("Target", { exact: true })).toHaveCount(0);
    await d.getByLabel("How it's measured").selectOption("count");
    await expect(d.getByLabel("Target", { exact: true })).toBeVisible();
    await d.getByLabel("How it's measured").selectOption("time");
    await expect(d.getByLabel("Target time")).toBeVisible();
    await expect(d.getByLabel("Grace minutes")).toBeVisible();
    await d.getByLabel("How often").selectOption("weekdays");
    await expect(d.getByText("Mon", { exact: true })).toBeVisible();
  });

  test("pause a habit: it leaves Today's checklist until resumed", async ({ page }) => {
    await openHabits(page, P1);
    await habitAction(page, "Bath", "Pause habit", "For 3 days");
    const bath = phase(page, P1).getByRole("button", { name: /^Bath/ });
    await expect(bath).toContainText("Paused until");

    await page.goto("/");
    await expect(page.locator('[data-habit-row="Bath"]')).toHaveCount(0);
    await expect(page.getByText("Not due today (1)")).toBeVisible();

    await openHabits(page, P1);
    await habitAction(page, "Bath", "Resume habit");
    await expect(bath).not.toContainText("Paused until");
  });

  test("reorder with the menu (no drag needed)", async ({ page }) => {
    await openHabits(page, P1);
    await habitAction(page, "Wake up on time", "Reorder", "Move down");
    await expect(habitNames(page, P1).nth(0)).toHaveText("Water first thing in the morning");
    await expect(habitNames(page, P1).nth(1)).toHaveText("Wake up on time");
  });

  test("add, rename and delete a phase", async ({ page }) => {
    await openHabits(page);
    await page.getByRole("button", { name: "Add phase" }).click();
    await dialog(page).getByLabel("Name").fill("Summer goals");
    await dialog(page).getByRole("button", { name: "Add phase" }).click();
    await expect(phase(page, "Phase 6 · Summer goals")).toBeVisible();

    await page.getByRole("button", { name: "Actions for phase Summer goals" }).click();
    await page.getByRole("menuitem", { name: "Edit phase" }).click();
    await dialog(page).getByLabel("Name").fill("Monsoon goals");
    await dialog(page).getByRole("button", { name: "Save changes" }).click();
    await expect(phase(page, "Phase 6 · Monsoon goals")).toBeVisible();

    await page.getByRole("button", { name: "Actions for phase Monsoon goals" }).click();
    await page.getByRole("menuitem", { name: "Delete phase" }).click();
    await page.getByRole("button", { name: "Delete phase" }).click();
    await expect(phase(page, "Phase 6 · Monsoon goals")).toHaveCount(0);
  });

  test("a phase with habits can't be deleted", async ({ page }) => {
    await openHabits(page);
    await page.getByRole("button", { name: "Actions for phase Foundation" }).click();
    await page.getByRole("menuitem", { name: "Delete phase" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Move or delete them first.");
    await expect(
      page.getByRole("alertdialog").getByRole("button", { name: "Delete phase" }),
    ).toHaveCount(0);
  });

  test("no sideways scrolling on the page or in the form", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openHabits(page, P1);
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Add habit", exact: true }).first().click();
    await dialog(page).getByLabel("How it's measured").selectOption("numeric");
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
