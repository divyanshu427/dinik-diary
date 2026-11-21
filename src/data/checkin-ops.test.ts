import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { setCheckIn, setCheckInNote, type CheckInContext } from "./checkin-ops";
import { makeTestStore } from "./test-utils";

async function setup() {
  const { store } = makeTestStore();
  const ctx: CheckInContext = { store, dayStartHour: 4 };
  const habit = async (key: string) => {
    const h = (await store.habits.getByKey(key))!;
    return { habit: h, targets: await store.habitTargets.listByHabit(h.id) };
  };
  return { store, ctx, habit };
}

describe("checking in", () => {
  it("ticks a yes/no habit and unticks it again (the check-in is removed)", async () => {
    const { store, ctx, habit } = await setup();
    const bath = await habit("bath");
    const saved = await setCheckIn(ctx, {
      ...bath,
      date: "2026-11-20",
      entry: { value: 1, time: "08:10" },
    });
    expect(saved).toMatchObject({ done: true, progress: 100, time: "08:10", note: "" });

    await setCheckIn(ctx, { ...bath, date: "2026-11-20", entry: null });
    expect(await store.habitLogs.get(bath.habit.id, "2026-11-20")).toBeUndefined();
  });

  it("scores partial amounts against the target on that date", async () => {
    const { ctx, habit } = await setup();
    const steps = await habit("steps");
    const saved = await setCheckIn(ctx, {
      ...steps,
      date: "2026-11-20",
      entry: { value: 3420, time: null },
    });
    expect(saved).toMatchObject({ done: false, progress: 68.4 });
  });

  it("scores wake-up time with the grace window", async () => {
    const { ctx, habit } = await setup();
    const wake = await habit("wake_up");
    const late = await setCheckIn(ctx, {
      ...wake,
      date: "2026-11-20",
      entry: { value: null, time: "07:40" },
    });
    expect(late).toMatchObject({ done: false, progress: 50 });
  });

  it("keeps the note when the value changes, and notes can be edited on their own", async () => {
    const { ctx, habit } = await setup();
    const breakfast = await habit("healthy_breakfast");
    await setCheckIn(ctx, {
      ...breakfast,
      date: "2026-11-20",
      entry: { value: 1, time: "09:00" },
      note: "Guava",
    });
    const again = await setCheckIn(ctx, {
      ...breakfast,
      date: "2026-11-20",
      entry: { value: 1, time: "09:05" },
    });
    expect(again?.note).toBe("Guava");

    const edited = await setCheckInNote(ctx, breakfast.habit.id, "2026-11-20", "  Poha  ");
    expect(edited).toMatchObject({ note: "Poha", done: true, time: "09:05" });
  });

  it("won't add a note to a habit that wasn't logged", async () => {
    const { ctx, habit } = await setup();
    const bath = await habit("bath");
    await expect(setCheckInNote(ctx, bath.habit.id, "2026-11-20", "x")).rejects.toThrow();
  });

  it("older backups without notes still import", async () => {
    const { ctx, store, habit } = await setup();
    const bath = await habit("bath");
    await setCheckIn(ctx, { ...bath, date: "2026-11-20", entry: { value: 1, time: null } });
    const file = structuredClone(await store.exportAll()) as unknown as {
      schemaVersion: number;
      data: { habitLogs: Record<string, unknown>[] };
    };
    file.schemaVersion = 2;
    for (const l of file.data.habitLogs) delete l.note;
    const result = parseBackup(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.data.habitLogs[0].note).toBe("");
  });
});
