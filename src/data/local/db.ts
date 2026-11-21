import Dexie, { type Table } from "dexie";
import type {
  Activity,
  Category,
  Concern,
  ConcernUpdate,
  DayStatus,
  Habit,
  HabitLog,
  HabitTarget,
  HealthReport,
  LabValue,
  Metric,
  Phase,
  ReportFile,
  Settings,
} from "../schema";
import { logicalDate } from "@/lib/core/day";
import { SETTINGS_ID } from "../schema";
import { PART_OF_DAY_BY_KEY, PHASE_SEEDS } from "../seed/defaults";

export const DEFAULT_DB_NAME = "dinik-diary";

/** Version 1 tables and indexes. Never edit; add a new version instead. */
export const STORES_V1 = {
  phases: "id, number",
  categories: "id, parentId",
  habits: "id, &key, phaseId, categoryId",
  habitTargets: "id, habitId",
  habitLogs: "id, &[habitId+date], date, habitId",
  dayStatus: "date",
  activities: "id, date, categoryId",
  metrics: "id, &[date+key], date, key",
  concerns: "id, status",
  concernUpdates: "id, concernId, date",
  settings: "id",
} as const;

/** Version 5 adds the health report tables (Build Phase 12.5). */
export const STORES_V5 = {
  ...STORES_V1,
  healthReports: "id, date",
  reportFiles: "id, reportId",
  labValues: "id, name, date, reportId",
} as const;

/**
 * The browser database (IndexedDB via Dexie).
 * Index strings: first entry is the primary key; "&" = unique; "[a+b]" = compound index.
 * Changing indexes later = add `this.version(2).stores({...})` with an upgrade; never edit version 1.
 */
export class DinikDb extends Dexie {
  phases!: Table<Phase, string>;
  categories!: Table<Category, string>;
  habits!: Table<Habit, string>;
  habitTargets!: Table<HabitTarget, string>;
  habitLogs!: Table<HabitLog, string>;
  dayStatus!: Table<DayStatus, string>;
  activities!: Table<Activity, string>;
  metrics!: Table<Metric, string>;
  concerns!: Table<Concern, string>;
  concernUpdates!: Table<ConcernUpdate, string>;
  healthReports!: Table<HealthReport, string>;
  reportFiles!: Table<ReportFile, string>;
  labValues!: Table<LabValue, string>;
  settings!: Table<Settings, string>;

  constructor(name = DEFAULT_DB_NAME) {
    super(name);
    this.version(1).stores(STORES_V1);
    // Version 2: habits gained `partOfDay`. Starter habits get their usual value; others "anytime".
    this.version(2)
      .stores(STORES_V1)
      .upgrade((tx) =>
        tx
          .table<Habit>("habits")
          .toCollection()
          .modify((habit) => {
            if (!habit.partOfDay) habit.partOfDay = PART_OF_DAY_BY_KEY[habit.key] ?? "anytime";
          }),
      );
    // Version 3: phases gained target upgrades and a history (Build Phase 11).
    this.version(3)
      .stores(STORES_V1)
      .upgrade(async (tx) => {
        const settings = await tx.table<Settings>("settings").get(SETTINGS_ID);
        const config = {
          timeZone: settings?.timezone ?? "Asia/Kolkata",
          dayStartHour: settings?.dayStartHour ?? 4,
        };
        const steps = await tx.table<Habit>("habits").where("key").equals("steps").first();
        await tx
          .table<Phase>("phases")
          .toCollection()
          .modify((phase) => {
            phase.history ??=
              phase.startedAt && phase.status !== "locked"
                ? [{ date: logicalDate(new Date(phase.startedAt), config), kind: "started" }]
                : [];
            phase.targetUpgrades ??= [];
            // The starter Phase 2 raises daily steps to 8,000 (as its description always said).
            if (
              steps &&
              phase.number === 2 &&
              phase.name === PHASE_SEEDS[1]?.name &&
              phase.status === "locked" &&
              phase.targetUpgrades.length === 0
            ) {
              phase.targetUpgrades = [
                { habitId: steps.id, targetValue: 8000, targetTime: null, graceMinutes: 0 },
              ];
            }
          });
      });
    // Version 4: habits can be paused; concerns became health issues (Build Phase 12).
    this.version(4)
      .stores(STORES_V1)
      .upgrade(async (tx) => {
        await tx
          .table<Habit>("habits")
          .toCollection()
          .modify((habit) => {
            habit.pauses ??= [];
          });
        await tx
          .table<Concern>("concerns")
          .toCollection()
          .modify((c) => {
            c.kind ??= "concern";
            c.bodyArea ??= "";
            c.worseWith ??= "";
            c.helpsWith ??= "";
            c.strainHabitIds ??= [];
            c.adjustments ??= [];
            c.dismissed ??= [];
          });
      });
    // Version 5: health reports, their files and values (new, empty tables).
    this.version(5).stores(STORES_V5);
    // Version 6: settings remember the last backup and the reminder interval (Build Phase 13).
    this.version(6)
      .stores(STORES_V5)
      .upgrade((tx) =>
        tx
          .table<Settings>("settings")
          .toCollection()
          .modify((s) => {
            s.lastBackupAt ??= null;
            s.backupReminderDays ??= 7;
          }),
      );
    // Version 7 (2026-11-21): the starter "Water goal" (3 L) moved from Phase 3 to Phase 1.
    // Existing databases get the same move, but only while it's still where the starter data
    // put it (a locked phase, not Phase 1): a habit someone moved themselves stays put.
    this.version(7)
      .stores(STORES_V5)
      .upgrade(async (tx) => {
        const habits = tx.table<Habit>("habits");
        const water = await habits.where("key").equals("water_goal").first();
        if (!water || water.archived) return;
        const phases = await tx.table<Phase>("phases").toArray();
        const phase1 = phases.find((p) => p.number === 1);
        const current = phases.find((p) => p.id === water.phaseId);
        if (!phase1 || !current || current.id === phase1.id || current.status !== "locked") return;

        // Right after "Water first thing in the morning" (or at the end of Phase 1).
        const list = (await habits.where("phaseId").equals(phase1.id).toArray()).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );
        const after = list.findIndex((h) => h.key === "morning_water");
        list.splice(after >= 0 ? after + 1 : list.length, 0, water);
        for (const [i, h] of list.entries()) {
          const patch = h.id === water.id ? { phaseId: phase1.id, sortOrder: i } : { sortOrder: i };
          await habits.update(h.id, patch);
        }
      });
  }

  /** Every table, for "clear everything" operations. */
  get allTables() {
    return [
      this.phases,
      this.categories,
      this.habits,
      this.habitTargets,
      this.habitLogs,
      this.dayStatus,
      this.activities,
      this.metrics,
      this.concerns,
      this.concernUpdates,
      this.healthReports,
      this.reportFiles,
      this.labValues,
      this.settings,
    ];
  }
}
