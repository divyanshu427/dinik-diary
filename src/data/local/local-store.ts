import type { Dexie, Table, TransactionMode } from "dexie";
import type { ZodType } from "zod";
import { BACKUP_APP_ID, BACKUP_FORMAT, summarize, type BackupFile } from "../backup";
import {
  NotFoundError,
  type CrudRepo,
  type DataStore,
  type HabitLogInput,
  type TableCounts,
} from "../repositories";
import {
  activitySchema,
  categorySchema,
  concernSchema,
  concernUpdateSchema,
  dayStatusSchema,
  habitLogSchema,
  habitSchema,
  habitTargetSchema,
  healthReportSchema,
  labValueSchema,
  metricSchema,
  phaseSchema,
  reportFileSchema,
  SCHEMA_VERSION,
  SETTINGS_ID,
  settingsSchema,
  type Metric,
  type NewRow,
  type RowPatch,
  type Settings,
} from "../schema";
import { buildSeed, type SeedOptions } from "../seed/defaults";
import { DinikDb } from "./db";

export interface LocalStoreOptions {
  dbName?: string;
  /** Clock and id generator, replaceable in tests. */
  now?: () => string;
  newId?: () => string;
  /** Theme to keep when seeding (read from localStorage in the browser). */
  getTheme?: () => SeedOptions["theme"];
}

/** Thrown when deleting something other rows still use. */
export class InUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InUseError";
  }
}

type Row = { id: string; createdAt: string; updatedAt: string };

/**
 * Runs a Dexie transaction but re-throws our own errors (NotFoundError, InUseError, Zod
 * validation errors) as they are. Dexie otherwise wraps them in a generic abort error.
 * The transaction still rolls back on any error.
 */
async function runTx<R>(
  db: Dexie,
  mode: TransactionMode,
  tables: Table | Table[],
  fn: () => Promise<R>,
): Promise<R> {
  let appError: unknown;
  try {
    const list = Array.isArray(tables) ? tables : [tables];
    return await db.transaction(mode, list, async () => {
      try {
        return await fn();
      } catch (e) {
        appError = e;
        throw e;
      }
    });
  } catch (e) {
    throw appError ?? e;
  }
}

/** Generic create/read/update/delete for a table with an `id`, validating every write. */
function crud<T extends Row>(
  name: string,
  table: Table<T, string>,
  schema: ZodType<T>,
  now: () => string,
  newId: () => string,
): CrudRepo<T> {
  return {
    list: () => table.toArray(),
    get: (id) => table.get(id),
    async create(input: NewRow<T>) {
      const ts = now();
      const row = schema.parse({ ...input, id: input.id ?? newId(), createdAt: ts, updatedAt: ts });
      await table.add(row);
      return row;
    },
    async update(id, patch: RowPatch<T>) {
      return runTx(table.db, "rw", table, async () => {
        const current = await table.get(id);
        if (!current) throw new NotFoundError(name, id);
        const row = schema.parse({
          ...current,
          ...patch,
          id,
          createdAt: current.createdAt,
          updatedAt: now(),
        });
        await table.put(row);
        return row;
      });
    },
    remove: (id) => table.delete(id),
  };
}

/** Inclusive date-range query on a "date" index. */
function inRange<T>(table: Table<T, string>, from: string, to: string) {
  return table.where("date").between(from, to, true, true).toArray();
}

export function createLocalDataStore(options: LocalStoreOptions = {}): DataStore {
  const now = options.now ?? (() => new Date().toISOString());
  const newId = options.newId ?? (() => crypto.randomUUID());
  const db = new DinikDb(options.dbName);

  const seed = () => buildSeed({ now: now(), newId, theme: options.getTheme?.() });

  // First time the database is created on this device: load the starter data.
  db.on("populate", (tx) => {
    const s = seed();
    tx.table("phases").bulkAdd(s.phases);
    tx.table("categories").bulkAdd(s.categories);
    tx.table("habits").bulkAdd(s.habits);
    tx.table("habitTargets").bulkAdd(s.habitTargets);
    tx.table("settings").add(s.settings);
  });

  const phases = crud("phases", db.phases, phaseSchema, now, newId);
  const categories = crud("categories", db.categories, categorySchema, now, newId);
  const habitsBase = crud("habits", db.habits, habitSchema, now, newId);
  const habitTargets = crud("habitTargets", db.habitTargets, habitTargetSchema, now, newId);
  const activities = crud("activities", db.activities, activitySchema, now, newId);
  const concernsBase = crud("concerns", db.concerns, concernSchema, now, newId);
  const concernUpdates = crud("concernUpdates", db.concernUpdates, concernUpdateSchema, now, newId);
  const healthReports = crud("healthReports", db.healthReports, healthReportSchema, now, newId);
  const reportFiles = crud("reportFiles", db.reportFiles, reportFileSchema, now, newId);
  const labValues = crud("labValues", db.labValues, labValueSchema, now, newId);

  async function exportAll(): Promise<BackupFile> {
    return runTx(db, "r", db.allTables, async () => {
      const settings = await db.settings.get(SETTINGS_ID);
      if (!settings) throw new NotFoundError("settings", SETTINGS_ID);
      return {
        app: BACKUP_APP_ID,
        format: BACKUP_FORMAT,
        schemaVersion: SCHEMA_VERSION,
        exportedAt: now(),
        data: {
          phases: await db.phases.orderBy("number").toArray(),
          categories: await db.categories.toArray(),
          habits: await db.habits.toArray(),
          habitTargets: await db.habitTargets.toArray(),
          habitLogs: await db.habitLogs.toArray(),
          dayStatus: await db.dayStatus.toArray(),
          activities: await db.activities.toArray(),
          metrics: await db.metrics.toArray(),
          concerns: await db.concerns.toArray(),
          concernUpdates: await db.concernUpdates.toArray(),
          healthReports: await db.healthReports.toArray(),
          reportFiles: await db.reportFiles.toArray(),
          labValues: await db.labValues.toArray(),
          settings,
        },
      };
    });
  }

  return {
    phases: {
      ...phases,
      async remove(id) {
        const used = await db.habits.where("phaseId").equals(id).count();
        if (used) throw new InUseError(`This phase still has ${used} habit(s). Move them first.`);
        await phases.remove(id);
      },
    },

    categories: {
      ...categories,
      async remove(id) {
        const habits = await db.habits.where("categoryId").equals(id).count();
        const acts = await db.activities.where("categoryId").equals(id).count();
        const subs = await db.categories.where("parentId").equals(id).count();
        if (habits || acts || subs) {
          throw new InUseError("This category is still in use. Merge or archive it instead.");
        }
        await categories.remove(id);
      },
    },

    habits: {
      ...habitsBase,
      getByKey: (key) => db.habits.where("key").equals(key).first(),
      listByPhase: (phaseId) => db.habits.where("phaseId").equals(phaseId).sortBy("sortOrder"),
      /** Deleting a habit also deletes its targets and logs, and unlinks it from health issues. */
      remove: (id) =>
        runTx(db, "rw", [db.habits, db.habitTargets, db.habitLogs, db.concerns], async () => {
          await db.habitTargets.where("habitId").equals(id).delete();
          await db.habitLogs.where("habitId").equals(id).delete();
          await db.concerns.toCollection().modify((c) => {
            c.linkedHabitIds = c.linkedHabitIds.filter((h) => h !== id);
            c.strainHabitIds = (c.strainHabitIds ?? []).filter((h) => h !== id);
          });
          await db.habits.delete(id);
        }),
    },

    habitTargets: {
      ...habitTargets,
      listByHabit: (habitId) =>
        db.habitTargets.where("habitId").equals(habitId).sortBy("validFrom"),
    },

    habitLogs: {
      get: (habitId, date) => db.habitLogs.where("[habitId+date]").equals([habitId, date]).first(),
      listByDate: (date) => db.habitLogs.where("date").equals(date).toArray(),
      listByHabit: (habitId) => db.habitLogs.where("habitId").equals(habitId).sortBy("date"),
      countForHabit: (habitId) => db.habitLogs.where("habitId").equals(habitId).count(),
      listRange: (from, to) => inRange(db.habitLogs, from, to),
      upsert: (habitId, date, input: HabitLogInput) =>
        runTx(db, "rw", db.habitLogs, async () => {
          const current = await db.habitLogs
            .where("[habitId+date]")
            .equals([habitId, date])
            .first();
          const ts = now();
          const row = habitLogSchema.parse({
            source: "web",
            rawMessageId: null,
            ...current,
            ...input,
            // Identity fields always win over anything spread above.
            id: current?.id ?? newId(),
            createdAt: current?.createdAt ?? ts,
            updatedAt: ts,
            habitId,
            date,
          });
          await db.habitLogs.put(row);
          return row;
        }),
      remove: async (habitId, date) => {
        await db.habitLogs.where("[habitId+date]").equals([habitId, date]).delete();
      },
    },

    dayStatus: {
      get: (date) => db.dayStatus.get(date),
      listRange: (from, to) => inRange(db.dayStatus, from, to),
      async set(date, value) {
        const row = dayStatusSchema.parse({ date, ...value, updatedAt: now() });
        await db.dayStatus.put(row);
        return row;
      },
    },

    activities: {
      ...activities,
      listRange: (from, to) => inRange(db.activities, from, to),
    },

    metrics: {
      listByDate: (date) => db.metrics.where("date").equals(date).toArray(),
      async listRange(from, to, key) {
        const rows = await inRange(db.metrics, from, to);
        return key ? rows.filter((m) => m.key === key) : rows;
      },
      upsert: (date, key, value: Pick<Metric, "valueNum" | "valueTime">) =>
        runTx(db, "rw", db.metrics, async () => {
          const current = await db.metrics.where("[date+key]").equals([date, key]).first();
          const ts = now();
          const row = metricSchema.parse({
            id: current?.id ?? newId(),
            createdAt: current?.createdAt ?? ts,
            updatedAt: ts,
            date,
            key,
            ...value,
          });
          await db.metrics.put(row);
          return row;
        }),
      remove: async (date, key) => {
        await db.metrics.where("[date+key]").equals([date, key]).delete();
      },
    },

    concerns: {
      ...concernsBase,
      /** Deleting a concern also deletes its updates. */
      remove: (id) =>
        runTx(db, "rw", [db.concerns, db.concernUpdates], async () => {
          await db.concernUpdates.where("concernId").equals(id).delete();
          await db.concerns.delete(id);
        }),
    },

    concernUpdates: {
      ...concernUpdates,
      listByConcern: (concernId) =>
        db.concernUpdates.where("concernId").equals(concernId).sortBy("date"),
    },

    healthReports,
    reportFiles: {
      ...reportFiles,
      listByReport: (reportId) => db.reportFiles.where("reportId").equals(reportId).toArray(),
    },
    labValues: {
      ...labValues,
      listByReport: (reportId) => db.labValues.where("reportId").equals(reportId).toArray(),
    },

    settings: {
      async get() {
        const row = await db.settings.get(SETTINGS_ID);
        if (!row) throw new NotFoundError("settings", SETTINGS_ID);
        return row;
      },
      update: (patch) =>
        runTx(db, "rw", db.settings, async () => {
          const current = await db.settings.get(SETTINGS_ID);
          if (!current) throw new NotFoundError("settings", SETTINGS_ID);
          const row: Settings = settingsSchema.parse({
            ...current,
            ...patch,
            id: SETTINGS_ID,
            seededAt: current.seededAt,
            updatedAt: now(),
          });
          await db.settings.put(row);
          return row;
        }),
    },

    async counts(): Promise<TableCounts> {
      const [
        phasesN,
        categoriesN,
        habitsN,
        habitTargetsN,
        habitLogsN,
        dayStatusN,
        activitiesN,
        metricsN,
        concernsN,
        concernUpdatesN,
        healthReportsN,
        reportFilesN,
        labValuesN,
        settingsN,
      ] = await Promise.all(db.allTables.map((t) => t.count()));
      return {
        phases: phasesN,
        categories: categoriesN,
        habits: habitsN,
        habitTargets: habitTargetsN,
        habitLogs: habitLogsN,
        dayStatus: dayStatusN,
        activities: activitiesN,
        metrics: metricsN,
        concerns: concernsN,
        concernUpdates: concernUpdatesN,
        healthReports: healthReportsN,
        reportFiles: reportFilesN,
        labValues: labValuesN,
        settings: settingsN,
      };
    },

    exportAll,

    atomically: (work) => runTx(db, "rw", db.allTables, work),

    async importAll(file) {
      const { data } = file;
      await runTx(db, "rw", db.allTables, async () => {
        await Promise.all(db.allTables.map((t) => t.clear()));
        await db.phases.bulkAdd(data.phases);
        await db.categories.bulkAdd(data.categories);
        await db.habits.bulkAdd(data.habits);
        await db.habitTargets.bulkAdd(data.habitTargets);
        await db.habitLogs.bulkAdd(data.habitLogs);
        await db.dayStatus.bulkAdd(data.dayStatus);
        await db.activities.bulkAdd(data.activities);
        await db.metrics.bulkAdd(data.metrics);
        await db.concerns.bulkAdd(data.concerns);
        await db.concernUpdates.bulkAdd(data.concernUpdates);
        await db.healthReports.bulkAdd(data.healthReports);
        await db.reportFiles.bulkAdd(data.reportFiles);
        await db.labValues.bulkAdd(data.labValues);
        await db.settings.add(data.settings);
      });
      return summarize(data);
    },

    async resetToDefaults() {
      await runTx(db, "rw", db.allTables, async () => {
        const current = await db.settings.get(SETTINGS_ID);
        const s = buildSeed({
          now: now(),
          newId,
          theme: current
            ? { preset: current.themePreset, mode: current.colorMode }
            : options.getTheme?.(),
        });
        await Promise.all(db.allTables.map((t) => t.clear()));
        await db.phases.bulkAdd(s.phases);
        await db.categories.bulkAdd(s.categories);
        await db.habits.bulkAdd(s.habits);
        await db.habitTargets.bulkAdd(s.habitTargets);
        await db.settings.add(s.settings);
      });
    },
  };
}

/** For tests: delete a database completely. */
export async function deleteLocalDatabase(name: string) {
  await new DinikDb(name).delete();
}
