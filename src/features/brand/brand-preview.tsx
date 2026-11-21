"use client";

import { useState } from "react";
import { SectionCard as Section } from "@/components/section-card";
import { brand } from "@/brand/brand.config";
import { CompletionHeatmap } from "@/components/charts/completion-heatmap";
import { TimeDonut } from "@/components/charts/time-donut";
import { SegmentedControl } from "@/components/segmented-control";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/copy";
import { getPreset } from "@/theme/presets";
import {
  CHART_TOKENS,
  HEATMAP_TOKENS,
  NEUTRAL_CHART_TOKENS,
  tokenVar,
  type ResolvedMode,
  type TokenName,
} from "@/theme/tokens";
import { useTheme } from "@/theme/use-theme";
import { sampleHeatmap, sampleStats, sampleTimeSlices } from "./sample-data";
import { ThemeControls } from "@/features/settings/theme-controls";

const t = copy.brandPage;

const SWATCH_GROUPS: { title: string; tokens: TokenName[] }[] = [
  { title: "Surfaces", tokens: ["background", "card", "muted", "accent", "border", "input"] },
  { title: "Text", tokens: ["foreground", "muted-foreground", "accent-foreground"] },
  { title: "Actions and status", tokens: ["primary", "ring", "success", "warning", "destructive"] },
];

const PERIODS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all", label: "All time" },
] as const;

export function BrandPreview() {
  const { preset, resolvedMode } = useTheme();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["value"]>("month");
  const totalHours = sampleTimeSlices.reduce((s, x) => s + x.hours, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground">
            {brand.monogram}
          </span>
          <div>
            <p className="text-sm font-medium text-primary">{brand.name}</p>
            <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          </div>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">{t.intro}</p>
      </header>

      <Section title={t.sections.theme}>
        <ThemeControls />
      </Section>

      <section aria-labelledby="stats-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="stats-title" className="text-lg font-semibold">
            {t.sections.stats}{" "}
            <Badge variant="secondary" className="align-middle">
              {copy.common.sampleData}
            </Badge>
          </h2>
          <SegmentedControl
            label="Report period"
            options={PERIODS}
            value={period}
            onChange={setPeriod}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sampleStats.map((s) => (
            <StatTile key={s.label} {...s} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Section title={copy.report.timeTitle} subtitle={copy.report.timeSubtitle(totalHours)}>
          <TimeDonut slices={sampleTimeSlices} />
        </Section>
        <Section title={copy.report.completionTitle} subtitle={copy.report.completionSubtitle}>
          <CompletionHeatmap {...sampleHeatmap} />
        </Section>
      </div>

      <Section title={t.sections.components}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Active</Badge>
            <Badge variant="secondary">Phase 1</Badge>
            <Badge variant="outline">Scheduled</Badge>
            <Badge variant="destructive">Missed</Badge>
          </div>
          <div className="grid max-w-md gap-2">
            <Label htmlFor="sample-input">Habit name</Label>
            <Input id="sample-input" placeholder="e.g. Drink water first thing" />
          </div>
        </div>
      </Section>

      <Section title={t.sections.colours} subtitle={t.coloursHint}>
        <div className="grid gap-6 md:grid-cols-3">
          {SWATCH_GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-sm font-semibold">{g.title}</h3>
              <ul className="flex flex-col gap-2">
                {g.tokens.map((token) => (
                  <Swatch key={token} token={token} preset={preset} mode={resolvedMode} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title={t.sections.chartColours} subtitle={t.chartColoursHint}>
          <ul className="grid grid-cols-2 gap-2">
            {[...CHART_TOKENS, ...NEUTRAL_CHART_TOKENS].map((token) => (
              <Swatch key={token} token={token} preset={preset} mode={resolvedMode} />
            ))}
          </ul>
        </Section>
        <Section title={t.sections.heatmapScale} subtitle={t.heatmapHint}>
          <ul className="flex flex-col gap-2">
            {HEATMAP_TOKENS.map((token) => (
              <Swatch key={token} token={token} preset={preset} mode={resolvedMode} />
            ))}
          </ul>
        </Section>
      </div>

      <Section title={t.sections.sideBySide} subtitle={t.sideBySideHint}>
        <div className="grid gap-4 md:grid-cols-2">
          {(["light", "dark"] as const).map((m) => (
            <ModePanel key={m} preset={preset} mode={m} />
          ))}
        </div>
      </Section>

      <Section title={t.sections.typography}>
        <div className="flex flex-col gap-3">
          <p className="font-heading text-4xl font-bold tracking-tight">November report</p>
          <p className="font-heading text-2xl font-semibold">Where your time went</p>
          <p className="font-heading text-3xl font-semibold tabular-nums">
            74% · 11 days · 52 min/day
          </p>
          <p className="max-w-prose">
            Body text uses Inter. Headings and big numbers use Space Grotesk. You skipped skincare
            on 6 of the 7 days you skipped breakfast.
          </p>
          <p className="text-sm text-muted-foreground">Secondary text for hints and captions.</p>
        </div>
      </Section>
    </div>
  );
}

function Swatch({ token, preset, mode }: { token: TokenName; preset: string; mode: ResolvedMode }) {
  const value = getPreset(preset)?.[mode][token];
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden
        className="size-8 shrink-0 rounded-lg border"
        style={{ background: tokenVar(token) }}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{token}</span>
        <span className="block font-mono text-xs text-muted-foreground uppercase">{value}</span>
      </span>
    </li>
  );
}

/** A small panel that forces its own theme mode via data attributes. */
function ModePanel({ preset, mode }: { preset: string; mode: ResolvedMode }) {
  return (
    <div
      data-theme={preset}
      data-mode={mode}
      className="rounded-xl border bg-background p-4 text-foreground"
    >
      <p className="mb-3 text-sm font-semibold">{copy.theme.modes[mode]}</p>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">Habit completion</p>
        <p className="font-heading text-3xl font-semibold">74%</p>
        <p className="text-sm font-medium text-success">Up 6 points from October</p>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
          {[...CHART_TOKENS, "chart-unlogged" as const].map((tk) => (
            <span key={tk} className="h-3 w-6 rounded-sm" style={{ background: tokenVar(tk) }} />
          ))}
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {HEATMAP_TOKENS.map((tk) => (
            <span key={tk} className="size-4 rounded-sm" style={{ background: tokenVar(tk) }} />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Primary
          </span>
          <span className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium">Muted</span>
        </div>
      </div>
    </div>
  );
}
