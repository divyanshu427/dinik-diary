"use client";

import { ChevronRight, Ellipsis, FileText, FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Cell, Dashboard, Panel } from "@/components/dashboard";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copy } from "@/copy";
import type { HealthReport, LabValue } from "@/data/schema";
import { formatNumber } from "@/features/today/format";
import { TrendChart, type TrendSeries } from "@/features/reports/trend-chart";
import { useHealthIssues } from "@/hooks/use-health";
import {
  useHealthReports,
  useLabValues,
  useReportEditor,
  useReportFiles,
} from "@/hooks/use-reports";
import { useToday } from "@/hooks/use-today";
import { labSeries, labStatus, parseIsoDate, type IsoDate, type LabSeries } from "@/lib/core";
import { cn } from "@/lib/utils";
import { formatBytes, openDataUrl } from "./files";
import { HealthTabs } from "./health-tabs";
import { ReportDialog } from "./report-dialog";
import { ValueDialog } from "./value-dialog";

const r = copy.pages.health.reports;
const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const fmt = (d: IsoDate) => {
  const { year, month, day } = parseIsoDate(d);
  return shortDate.format(new Date(year, month - 1, day));
};
const n = (v: number | null) => (v === null ? null : formatNumber(v));

/** Health → Reports and values (Build Phase 12.5). */
export function ReportsScreen() {
  const reports = useHealthReports();
  const files = useReportFiles();
  const values = useLabValues();
  const issues = useHealthIssues();
  const today = useToday();
  const editor = useReportEditor();
  const [dialog, setDialog] = useState<{ report: HealthReport | null } | null>(null);
  const [addingValue, setAddingValue] = useState(false);
  const [toDelete, setToDelete] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const series = useMemo(() => labSeries(values.data ?? []), [values.data]);

  const header = (eyebrow?: string) => (
    <PageHeader
      eyebrow={eyebrow}
      title={r.title}
      subtitle={r.subtitle}
      actions={
        <div
          data-tour="hr-add"
          className="flex flex-wrap items-center gap-2 max-md:grid max-md:w-full max-md:grid-cols-2 max-md:gap-3"
        >
          <HealthTabs />
          <Button
            variant="outline"
            onClick={() => setAddingValue(true)}
            className="max-md:h-12 max-md:rounded-xl max-md:text-base"
          >
            <Plus aria-hidden />
            {r.addValue}
          </Button>
          <Button
            onClick={() => setDialog({ report: null })}
            className="max-md:h-12 max-md:rounded-xl max-md:text-base"
          >
            <Plus aria-hidden />
            {r.add}
          </Button>
        </div>
      }
    />
  );

  if ([reports, files, values, issues].some((q) => q.isError)) {
    return (
      <>
        {header()}
        <p role="alert" className="text-sm text-destructive">
          {r.loadError}
        </p>
      </>
    );
  }
  if (!reports.data || !files.data || !values.data || !issues.data || !today) {
    return (
      <>
        {header()}
        <p className="text-sm text-muted-foreground">{r.loading}</p>
      </>
    );
  }

  const run = (work: Promise<unknown>) => {
    setError(null);
    work.catch((e) =>
      setError(copy.pages.health.failed(e instanceof Error ? e.message : String(e))),
    );
  };
  const issueById = new Map(issues.data.map((i) => [i.id, i]));
  const filesOf = (id: string) => files.data!.filter((x) => x.reportId === id);
  const valuesOf = (id: string) =>
    values.data!.filter((x) => x.reportId === id).sort((a, b) => a.name.localeCompare(b.name));
  const outOfRange = series.filter((s) => s.status === "low" || s.status === "high");
  const totalBytes = files.data.reduce((sum, x) => sum + x.size, 0);
  const editing = dialog?.report ?? null;

  return (
    <>
      {header(r.eyebrow(reports.data.length, series.length))}
      <div aria-live="polite">
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>

      {reports.data.length === 0 && values.data.length === 0 ? (
        <EmptyState icon={FlaskConical} title={r.empty.title} body={r.empty.body}>
          <Button onClick={() => setDialog({ report: null })}>
            <Plus aria-hidden />
            {r.add}
          </Button>
        </EmptyState>
      ) : (
        <Dashboard>
          <Cell span={12} fullOnTablet>
            <div
              className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:gap-5"
              data-testid="report-health-tiles"
              data-tour="hr-tiles"
            >
              <StatTile
                label={r.tiles.reports}
                value={String(reports.data.length)}
                note={r.tiles.reportsNote(reports.data[0] ? fmt(reports.data[0].date) : null)}
              />
              <StatTile
                label={r.tiles.values}
                value={String(series.length)}
                note={r.tiles.valuesNote}
              />
              <StatTile
                label={r.tiles.outOfRange}
                value={String(outOfRange.length)}
                note={r.tiles.outOfRangeNote(outOfRange.map((s) => s.name))}
                tone={outOfRange.length ? "warning" : "positive"}
              />
              <StatTile
                label={r.tiles.files}
                value={String(files.data.length)}
                note={r.tiles.filesNote(formatBytes(totalBytes))}
              />
            </div>
          </Cell>

          <Panel
            span={7}
            tour="hr-list"
            title={r.list.title}
            subtitle={r.list.subtitle}
            bodyClassName="-mx-5 -mb-5 border-t"
          >
            <ul className="divide-y" data-testid="report-list">
              {reports.data.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  files={filesOf(report.id)}
                  values={valuesOf(report.id)}
                  issueNames={report.concernIds
                    .map((id) => issueById.get(id)?.title)
                    .filter((x): x is string => !!x)}
                  onEdit={() => setDialog({ report })}
                  onDelete={() => setToDelete(report)}
                  onOpen={(data) => run(openDataUrl(data))}
                />
              ))}
            </ul>
          </Panel>

          <Panel span={5} tour="hr-values" title={r.values.title} subtitle={r.values.subtitle}>
            <ValuesPanel
              series={series}
              onDelete={(id) => run(editor.deleteValue.mutateAsync([id]))}
            />
          </Panel>
        </Dashboard>
      )}

      {dialog && (
        <ReportDialog
          report={editing}
          files={editing ? filesOf(editing.id) : []}
          values={editing ? valuesOf(editing.id) : []}
          issues={issues.data}
          series={series}
          today={today}
          onSubmit={(draft) => editor.saveReport.mutateAsync([editing?.id ?? null, draft])}
          onClose={() => setDialog(null)}
        />
      )}
      {addingValue && (
        <ValueDialog
          series={series}
          today={today}
          onSubmit={(date, draft) => editor.saveValue.mutateAsync([null, date, draft])}
          onClose={() => setAddingValue(false)}
        />
      )}
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toDelete ? r.list.deleteTitle(toDelete.title) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>{r.list.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{r.list.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const id = toDelete?.id;
                setToDelete(null);
                if (id) run(editor.deleteReport.mutateAsync([id]));
              }}
            >
              {r.list.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatusBadge({ status }: { status: "low" | "high" | "normal" | null }) {
  if (!status) return null;
  return (
    <Badge
      variant={status === "normal" ? "secondary" : "outline"}
      className={cn(status !== "normal" && "border-warning/60 text-warning")}
    >
      {r.values.status[status]}
    </Badge>
  );
}

function ReportRow({
  report,
  files,
  values,
  issueNames,
  onEdit,
  onDelete,
  onOpen,
}: {
  report: HealthReport;
  files: { id: string; name: string; mime: string; size: number; data: string }[];
  values: LabValue[];
  issueNames: string[];
  onEdit: () => void;
  onDelete: () => void;
  onOpen: (data: string) => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4" data-report={report.title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{fmt(report.date)}</p>
          <h3 className="font-heading text-base font-semibold">{report.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Badge variant="outline">{r.types[report.type]}</Badge>
            {report.doctor && <span>{report.doctor}</span>}
            {issueNames.length > 0 && <span>· {r.list.about(issueNames.join(", "))}</span>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={r.list.more(report.title)} />
            }
          >
            <Ellipsis aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil aria-hidden />
              {r.list.edit}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 aria-hidden />
              {r.list.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                onClick={() => onOpen(file.data)}
                aria-label={r.list.open(file.name)}
                className="flex items-center gap-2 rounded-lg border p-1.5 pr-2.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {file.mime.startsWith("image/") ? (
                  <Image
                    src={file.data}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="size-10 rounded object-cover"
                  />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded bg-muted">
                    <FileText aria-hidden className="size-5 text-muted-foreground" />
                  </span>
                )}
                <span className="max-w-36 truncate">{file.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" data-testid="report-values">
          {values.map((v) => {
            const status = labStatus(v.value, v.low, v.high);
            return (
              <li
                key={v.id}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  (status === "low" || status === "high") && "border-warning/60 text-warning",
                )}
              >
                {v.name}: <span className="font-medium tabular-nums">{formatNumber(v.value)}</span>{" "}
                {v.unit}
                {status && status !== "normal" && ` · ${r.values.status[status]}`}
              </li>
            );
          })}
        </ul>
      )}

      {report.notes && <p className="text-sm text-muted-foreground">{report.notes}</p>}
    </li>
  );
}

function ValuesPanel({
  series,
  onDelete,
}: {
  series: LabSeries[];
  onDelete: (id: string) => void;
}) {
  if (series.length === 0) return <p className="text-sm text-muted-foreground">{r.values.empty}</p>;

  const trend: TrendSeries[] = series.map((s) => ({
    key: s.name,
    label: s.name,
    points: s.points.map((p) => ({ date: p.date, value: p.value })),
    format: (v) => `${formatNumber(Math.round(v * 100) / 100)} ${s.unit}`.trim(),
    formatAxis: (v) => formatNumber(Math.round(v * 10) / 10),
    target: null,
    average: null,
    band: { low: s.latest.low, high: s.latest.high },
  }));

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y" data-testid="value-list">
        {series.map((s) => (
          <li key={s.name} data-value={s.name} className="py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt(s.latest.date)} · {r.values.range(n(s.latest.low), n(s.latest.high))}
                  {s.change !== null &&
                    ` · ${r.values.change(`${s.change > 0 ? "+" : ""}${formatNumber(s.change)}`)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-heading text-lg font-semibold tabular-nums">
                  {formatNumber(s.latest.value)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{s.unit}</span>
                </span>
                <StatusBadge status={s.status} />
              </div>
            </div>
            {s.points.length > 1 || s.points.some((p) => p.reportId === null) ? (
              <details className="group mt-1">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    aria-hidden
                    className="size-3.5 transition-transform group-open:rotate-90"
                  />
                  {r.values.history} ({s.points.length})
                </summary>
                <ul className="mt-1 flex flex-col text-xs">
                  {[...s.points].reverse().map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-muted-foreground">{fmt(p.date)}</span>
                      <span className="tabular-nums">
                        {formatNumber(p.value)} {p.unit}
                      </span>
                      <span className="text-muted-foreground">
                        {p.reportId ? r.values.fromReport : r.values.atHome}
                      </span>
                      {p.reportId === null ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={r.values.removeValue(s.name, fmt(p.date))}
                          onClick={() => onDelete(p.id)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      ) : (
                        <span className="w-7" />
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
      {trend.some((t) => t.points.length >= 2) && (
        <div className="border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">{r.values.trend}</h3>
          <TrendChart series={trend} />
        </div>
      )}
    </div>
  );
}
