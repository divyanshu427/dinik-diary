import { describe, expect, it } from "vitest";
import { labSeries, labStatus } from "@/lib/core";
import { parseBackup } from "./backup";
import type { OpsContext } from "./habit-ops";
import { createHealthIssue } from "./health-ops";
import {
  deleteReport,
  MAX_REPORT_FILE_BYTES,
  saveLabValue,
  saveReport,
  type ReportDraft,
} from "./report-ops";
import { makeTestStore } from "./test-utils";

const today = "2026-11-21";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

async function setup() {
  const { store } = makeTestStore();
  const ctx: OpsContext = { store, today, dayStartHour: 4 };
  const draft = (over: Partial<ReportDraft> = {}): ReportDraft => ({
    title: " Blood test ",
    type: "blood-test",
    date: "2026-11-12",
    doctor: "City Lab",
    notes: "",
    concernIds: [],
    addFiles: [{ name: "report.png", mime: "image/png", size: 12, data: PNG }],
    removeFileIds: [],
    values: [
      { name: "Vitamin D", value: 18, unit: "ng/mL", low: 30, high: 100, note: "" },
      { name: "TSH", value: 2.1, unit: "mIU/L", low: 0.4, high: 4, note: "" },
    ],
    ...over,
  });
  return { store, ctx, draft };
}

describe("health reports", () => {
  it("saves a report with its files and values in one step", async () => {
    const { store, ctx, draft } = await setup();
    const report = await saveReport(ctx, null, draft());
    expect(report).toMatchObject({ title: "Blood test", doctor: "City Lab" });
    expect(await store.reportFiles.listByReport(report.id)).toEqual([
      expect.objectContaining({ name: "report.png", data: PNG }),
    ]);
    const values = await store.labValues.listByReport(report.id);
    expect(values.map((v) => [v.name, v.value, v.date])).toEqual([
      ["Vitamin D", 18, "2026-11-12"],
      ["TSH", 2.1, "2026-11-12"],
    ]);
  });

  it("editing keeps saved values, removes dropped ones, and moves them to the new date", async () => {
    const { store, ctx, draft } = await setup();
    const report = await saveReport(ctx, null, draft());
    const [vitD] = await store.labValues.listByReport(report.id);
    const [file] = await store.reportFiles.listByReport(report.id);
    await saveReport(
      ctx,
      report.id,
      draft({
        date: "2026-11-13",
        addFiles: [],
        removeFileIds: [file.id],
        values: [
          {
            id: vitD.id,
            name: "Vitamin D",
            value: 19,
            unit: "ng/mL",
            low: 30,
            high: 100,
            note: "",
          },
        ],
      }),
    );
    expect(await store.reportFiles.listByReport(report.id)).toEqual([]);
    expect(
      (await store.labValues.listByReport(report.id)).map((v) => [v.id, v.value, v.date]),
    ).toEqual([[vitD.id, 19, "2026-11-13"]]);
  });

  it("refuses files over 10 MB, and saves nothing then", async () => {
    const { store, ctx, draft } = await setup();
    const big = {
      name: "scan.pdf",
      mime: "application/pdf",
      size: MAX_REPORT_FILE_BYTES + 1,
      data: "data:application/pdf;base64,AA==",
    };
    await expect(saveReport(ctx, null, draft({ addFiles: [big] }))).rejects.toThrow(/10 MB/);
    expect(await store.healthReports.list()).toEqual([]);
  });

  it("deleting a report deletes its files and values; my own values stay", async () => {
    const { store, ctx, draft } = await setup();
    const report = await saveReport(ctx, null, draft());
    await saveLabValue(ctx, null, today, {
      name: "Blood pressure (top)",
      value: 128,
      unit: "mmHg",
      low: null,
      high: 120,
      note: "at home",
    });
    await deleteReport(ctx, report.id);
    expect(await store.reportFiles.list()).toEqual([]);
    expect((await store.labValues.list()).map((v) => v.name)).toEqual(["Blood pressure (top)"]);
  });

  it("reports, files and values travel in the backup; older backups still import", async () => {
    const { store, ctx, draft } = await setup();
    const issue = await createHealthIssue(ctx, {
      title: "Hair fall",
      kind: "concern",
      bodyArea: "",
      startedAt: today,
      severity: 4,
      worseWith: "",
      helpsWith: "",
      triedSoFar: "",
      notes: "",
      linkedHabitIds: [],
      strainHabitIds: [],
    });
    await saveReport(ctx, null, draft({ concernIds: [issue.id] }));
    const file = await store.exportAll();
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(true);

    const { store: other } = makeTestStore();
    if (parsed.ok) await other.importAll(parsed.file);
    expect((await other.reportFiles.list())[0].data).toBe(PNG);
    expect(await other.labValues.list()).toHaveLength(2);

    const old = structuredClone(file) as unknown as {
      schemaVersion: number;
      data: Record<string, unknown>;
    };
    old.schemaVersion = 5;
    delete old.data.healthReports;
    delete old.data.reportFiles;
    delete old.data.labValues;
    const oldParsed = parseBackup(JSON.stringify(old));
    expect(oldParsed.ok).toBe(true);
    if (oldParsed.ok) expect(oldParsed.file.data.healthReports).toEqual([]);
  });

  it("deleting a habit unlinks it from health issues (backups stay valid)", async () => {
    const { store, ctx } = await setup();
    const bath = (await store.habits.getByKey("bath"))!;
    await createHealthIssue(ctx, {
      title: "Skin",
      kind: "concern",
      bodyArea: "",
      startedAt: today,
      severity: 3,
      worseWith: "",
      helpsWith: "",
      triedSoFar: "",
      notes: "",
      linkedHabitIds: [bath.id],
      strainHabitIds: [],
    });
    await store.habits.remove(bath.id);
    expect((await store.concerns.list())[0].linkedHabitIds).toEqual([]);
    expect(parseBackup(JSON.stringify(await store.exportAll())).ok).toBe(true);
  });
});

describe("report values", () => {
  it("low, high or normal against the report's own range", () => {
    expect(labStatus(18, 30, 100)).toBe("low");
    expect(labStatus(130, null, 120)).toBe("high");
    expect(labStatus(2.1, 0.4, 4)).toBe("normal");
    expect(labStatus(5, null, null)).toBeNull();
  });

  it("groups the same value across reports (any capitalisation), newest first", () => {
    const p = (id: string, name: string, date: string, value: number) => ({
      id,
      name,
      date,
      value,
      unit: "ng/mL",
      low: 30,
      high: 100,
      reportId: null,
    });
    const series = labSeries([
      p("1", "Vitamin D", "2026-08-01", 14),
      p("2", "vitamin d ", "2026-11-12", 24),
      p("3", "B12", "2026-10-01", 310),
    ]);
    expect(
      series.map((s) => [s.name, s.points.length, s.latest.value, s.change, s.status]),
    ).toEqual([
      ["Vitamin D", 2, 24, 10, "low"],
      ["B12", 1, 310, null, "high"],
    ]);
  });
});
