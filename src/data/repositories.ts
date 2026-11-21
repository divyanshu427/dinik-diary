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
  MetricKey,
  NewRow,
  Phase,
  ReportFile,
  RowPatch,
  Settings,
} from "./schema";
import type { BackupFile, ImportSummary } from "./backup";

/*
 * The data layer's public interface. Screens and hooks only talk to these interfaces,
 * never to IndexedDB directly. Stage 1 implements them with Dexie (src/data/local);
 * Stage 2 adds a Supabase implementation with the same interfaces.
 */

export interface CrudRepo<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(input: NewRow<T>): Promise<T>;
  update(id: string, patch: RowPatch<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

export type PhaseRepo = CrudRepo<Phase>;
export type CategoryRepo = CrudRepo<Category>;
export type ConcernRepo = CrudRepo<Concern>;

export interface HabitRepo extends CrudRepo<Habit> {
  getByKey(key: string): Promise<Habit | undefined>;
  listByPhase(phaseId: string): Promise<Habit[]>;
}

export interface HabitTargetRepo extends CrudRepo<HabitTarget> {
  listByHabit(habitId: string): Promise<HabitTarget[]>;
}

/** Values a habit log can be given; done/progress are worked out by the caller (Build Phase 4). */
export type HabitLogInput = Pick<HabitLog, "value" | "time" | "done" | "progress"> &
  Partial<Pick<HabitLog, "source" | "rawMessageId" | "note">>;

export interface HabitLogRepo {
  get(habitId: string, date: string): Promise<HabitLog | undefined>;
  listByDate(date: string): Promise<HabitLog[]>;
  listByHabit(habitId: string): Promise<HabitLog[]>;
  countForHabit(habitId: string): Promise<number>;
  /** Inclusive range of dates. */
  listRange(from: string, to: string): Promise<HabitLog[]>;
  /** One log per habit per day: creates it or updates the existing one. */
  upsert(habitId: string, date: string, input: HabitLogInput): Promise<HabitLog>;
  remove(habitId: string, date: string): Promise<void>;
}

export interface ActivityRepo extends CrudRepo<Activity> {
  listRange(from: string, to: string): Promise<Activity[]>;
}

export interface MetricRepo {
  listByDate(date: string): Promise<Metric[]>;
  listRange(from: string, to: string, key?: MetricKey): Promise<Metric[]>;
  /** One value per metric per day. */
  upsert(
    date: string,
    key: MetricKey,
    value: Pick<Metric, "valueNum" | "valueTime">,
  ): Promise<Metric>;
  remove(date: string, key: MetricKey): Promise<void>;
}

export interface DayStatusRepo {
  get(date: string): Promise<DayStatus | undefined>;
  listRange(from: string, to: string): Promise<DayStatus[]>;
  set(date: string, value: Pick<DayStatus, "type" | "note">): Promise<DayStatus>;
}

export interface ConcernUpdateRepo extends CrudRepo<ConcernUpdate> {
  listByConcern(concernId: string): Promise<ConcernUpdate[]>;
}

export type HealthReportRepo = CrudRepo<HealthReport>;

export interface ReportFileRepo extends CrudRepo<ReportFile> {
  listByReport(reportId: string): Promise<ReportFile[]>;
}

export interface LabValueRepo extends CrudRepo<LabValue> {
  listByReport(reportId: string): Promise<LabValue[]>;
}

export interface SettingsRepo {
  get(): Promise<Settings>;
  update(patch: Partial<Omit<Settings, "id" | "updatedAt" | "seededAt">>): Promise<Settings>;
}

export type TableCounts = Record<keyof BackupFile["data"], number>;

export interface DataStore {
  phases: PhaseRepo;
  categories: CategoryRepo;
  habits: HabitRepo;
  habitTargets: HabitTargetRepo;
  habitLogs: HabitLogRepo;
  dayStatus: DayStatusRepo;
  activities: ActivityRepo;
  metrics: MetricRepo;
  concerns: ConcernRepo;
  concernUpdates: ConcernUpdateRepo;
  healthReports: HealthReportRepo;
  reportFiles: ReportFileRepo;
  labValues: LabValueRepo;
  settings: SettingsRepo;

  /**
   * Runs several reads/writes as one step: if anything fails, none of the writes are kept.
   * Use for changes that touch more than one row (e.g. a habit and its target history).
   */
  atomically<T>(work: () => Promise<T>): Promise<T>;

  /** Row counts per table (for the Settings "your data" panel). */
  counts(): Promise<TableCounts>;
  /** Everything, as a backup file. */
  exportAll(): Promise<BackupFile>;
  /** Replaces ALL data with the backup. All-or-nothing: on any error nothing changes. */
  importAll(file: BackupFile): Promise<ImportSummary>;
  /** Deletes everything and loads the starter data again (theme choice is kept). */
  resetToDefaults(): Promise<void>;
}

/** Thrown when updating or reading a row that doesn't exist. */
export class NotFoundError extends Error {
  constructor(table: string, key: string) {
    super(`${table}: no row with id ${key}`);
    this.name = "NotFoundError";
  }
}
