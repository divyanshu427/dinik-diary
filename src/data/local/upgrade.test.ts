import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { parseBackup } from "../backup";
import { makeTestStore } from "../test-utils";
import { createLocalDataStore } from "./local-store";
import { STORES_V1 } from "./db";

describe("database upgrade to version 2 (part of day)", () => {
  it("adds part of day to habits saved before it existed", async () => {
    const name = `upgrade-${Math.random().toString(36).slice(2)}`;

    // A version-1 database, as it was before this change.
    const old = new Dexie(name);
    old.version(1).stores(STORES_V1);
    await old.table("habits").bulkAdd([
      { id: "a", key: "brush_night", name: "Brush teeth — night", phaseId: "p" },
      { id: "b", key: "my_custom_habit", name: "Custom", phaseId: "p" },
    ]);
    old.close();

    const store = createLocalDataStore({ dbName: name });
    const habits = await store.habits.list();
    expect(habits.find((h) => h.id === "a")?.partOfDay).toBe("night"); // starter habit: its usual value
    expect(habits.find((h) => h.id === "b")?.partOfDay).toBe("anytime"); // anything else
  });
});

describe("older backups", () => {
  it("still import when habits have no part of day", async () => {
    const { store } = makeTestStore();
    const file = await store.exportAll();
    const old = structuredClone(file) as unknown as {
      schemaVersion: number;
      data: { habits: Record<string, unknown>[] };
    };
    old.schemaVersion = 1;
    for (const h of old.data.habits) delete h.partOfDay;

    const result = parseBackup(JSON.stringify(old));
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.file.data.habits.every((h) => h.partOfDay === "anytime")).toBe(true);
  });
});

describe("database upgrade to version 3 (phase history and target upgrades)", () => {
  it("gives started phases a history and the starter Phase 2 its steps upgrade", async () => {
    const name = `upgrade3-${Math.random().toString(36).slice(2)}`;
    const old = new Dexie(name);
    old.version(2).stores(STORES_V1);
    await old.table("settings").add({ id: "settings", timezone: "Asia/Kolkata", dayStartHour: 4 });
    await old.table("habits").add({ id: "s", key: "steps", name: "Daily steps", phaseId: "p1" });
    await old.table("phases").bulkAdd([
      {
        id: "p1",
        number: 1,
        name: "Foundation",
        status: "active",
        startedAt: "2026-11-01T22:00:00.000Z", // 3:30 AM on 2 Nov in India: still 1 Nov
      },
      { id: "p2", number: 2, name: "Fitness and grooming", status: "locked", startedAt: null },
      { id: "p3", number: 3, name: "My own phase", status: "locked", startedAt: null },
    ]);
    old.close();

    const store = createLocalDataStore({ dbName: name });
    const byId = new Map((await store.phases.list()).map((p) => [p.id, p]));
    expect(byId.get("p1")?.history).toEqual([{ date: "2026-11-01", kind: "started" }]);
    expect(byId.get("p2")?.targetUpgrades).toEqual([
      { habitId: "s", targetValue: 8000, targetTime: null, graceMinutes: 0 },
    ]);
    expect(byId.get("p3")).toMatchObject({ history: [], targetUpgrades: [] });
  });
});
