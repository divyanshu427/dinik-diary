import { describe, expect, it } from "vitest";
import {
  createActivity,
  createCategory,
  deleteCategory,
  duplicateActivity,
  mergeCategories,
  minutesBetween,
  repeatDay,
  updateActivity,
  type ActivityContext,
  type ActivityDraft,
} from "./activity-ops";
import { InUseError } from "./local/local-store";
import { makeTestStore } from "./test-utils";

async function setup() {
  const { store } = makeTestStore();
  const ctx: ActivityContext = { store, dayStartHour: 4 };
  const categories = await store.categories.list();
  const cat = (name: string) => categories.find((c) => c.name === name)!;
  return { store, ctx, cat };
}

const draft = (categoryId: string, over: Partial<ActivityDraft> = {}): ActivityDraft => ({
  title: "Visited the fort",
  categoryId,
  subcategory: null,
  date: "2026-11-19",
  startTime: null,
  endTime: null,
  durationMinutes: null,
  place: null,
  people: [],
  notes: "",
  mood: null,
  energy: null,
  spend: null,
  tags: [],
  ...over,
});

describe("activity durations", () => {
  it("works out minutes from start and end, also past midnight", () => {
    expect(minutesBetween("17:00", "19:00", 4)).toBe(120);
    expect(minutesBetween("22:30", "01:00", 4)).toBe(150);
  });

  it("fills in the duration when start and end are given, and keeps a typed duration otherwise", async () => {
    const { ctx, cat } = await setup();
    const travel = cat("Travel and exploration").id;
    const timed = await createActivity(
      ctx,
      draft(travel, { startTime: "17:00", endTime: "19:00", durationMinutes: 5 }),
    );
    expect(timed).toMatchObject({ durationMinutes: 120, source: "web", confirmed: true });

    const untimed = await createActivity(ctx, draft(travel, { durationMinutes: 45 }));
    expect(untimed.durationMinutes).toBe(45);

    const edited = await updateActivity(
      ctx,
      untimed.id,
      draft(travel, { startTime: "10:00", endTime: "10:30" }),
    );
    expect(edited.durationMinutes).toBe(30);
  });
});

describe("copying activities", () => {
  it("copies one entry to another day", async () => {
    const { ctx, cat } = await setup();
    const a = await createActivity(ctx, draft(cat("Entertainment").id, { title: "Watched reels" }));
    const copy = await duplicateActivity(ctx, a.id, "2026-11-20");
    expect(copy).toMatchObject({ title: "Watched reels", date: "2026-11-20" });
    expect(copy.id).not.toBe(a.id);
  });

  it("repeats a whole day", async () => {
    const { store, ctx, cat } = await setup();
    await createActivity(ctx, draft(cat("Work and job search").id, { title: "Applications" }));
    await createActivity(ctx, draft(cat("Work and job search").id, { title: "Interview" }));
    expect(await repeatDay(ctx, "2026-11-19", "2026-11-20")).toBe(2);
    expect(
      (await store.activities.listRange("2026-11-20", "2026-11-20")).map((a) => a.title).sort(),
    ).toEqual(["Applications", "Interview"]);
  });
});

describe("categories", () => {
  it("adds a new category at the end of the list", async () => {
    const { store, ctx } = await setup();
    const c = await createCategory(ctx, {
      name: " Volunteering ",
      colorToken: "chart-other",
      customColor: null,
    });
    expect(c.name).toBe("Volunteering");
    expect(c.sortOrder).toBe(Math.max(...(await store.categories.list()).map((x) => x.sortOrder)));
  });

  it("merging moves every activity and habit, then removes the old category", async () => {
    const { store, ctx, cat } = await setup();
    const grooming = cat("Grooming and hygiene");
    const health = cat("Health and appointments");
    await createActivity(ctx, draft(grooming.id, { title: "Haircut" }));
    await createActivity(ctx, draft(grooming.id, { title: "Barber" }));

    await mergeCategories(ctx, grooming.id, health.id);

    expect(await store.categories.get(grooming.id)).toBeUndefined();
    const acts = await store.activities.list();
    expect(acts.every((a) => a.categoryId === health.id)).toBe(true);
    expect((await store.habits.list()).some((h) => h.categoryId === grooming.id)).toBe(false);
    expect((await store.habits.getByKey("bath"))?.categoryId).toBe(health.id);
  });

  it("an unused category can be deleted; a used one can't", async () => {
    const { ctx, cat } = await setup();
    const c = await createCategory(ctx, {
      name: "Temp",
      colorToken: "chart-other",
      customColor: null,
    });
    await expect(deleteCategory(ctx, c.id)).resolves.toBeUndefined();
    await expect(deleteCategory(ctx, cat("Sleep and rest").id)).rejects.toBeInstanceOf(InUseError);
  });
});
