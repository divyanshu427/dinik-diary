import type { Metadata } from "next";
import { Dashboard, Panel } from "@/components/dashboard";
import { PageHeader } from "@/components/page-header";
import { copy } from "@/copy";
import { BackupSection } from "@/features/settings/backup-section";
import { DataSummary } from "@/features/settings/data-summary";
import { DemoSection } from "@/features/settings/demo-section";
import { ThemeControls } from "@/features/settings/theme-controls";
import { DaySettings } from "@/features/settings/day-settings";
import { InstallCard } from "@/features/settings/install-card";
import { UnlockRule } from "@/features/settings/unlock-rule";

const p = copy.pages.settings;

export const metadata: Metadata = { title: p.title };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title={p.title} subtitle={p.subtitle} />
      <Dashboard>
        <Panel span={7} title={p.appearance} subtitle={p.appearanceHint}>
          <ThemeControls />
        </Panel>
        <Panel span={5} title={copy.pages.backup.title} subtitle={copy.pages.backup.hint}>
          <BackupSection />
        </Panel>
        <Panel span={8} title={copy.pages.data.title} subtitle={copy.pages.data.hint}>
          <DataSummary />
        </Panel>
        <Panel span={4} title={copy.pages.demo.title} subtitle={copy.pages.demo.hint}>
          <DemoSection />
        </Panel>
        <Panel span={7} title={p.day.title} subtitle={p.day.hint}>
          <DaySettings />
        </Panel>
        <Panel span={5} title={p.install.title} subtitle={p.install.hint}>
          <InstallCard />
        </Panel>
        <Panel span={12} title={p.unlock.title} subtitle={p.unlock.hint}>
          <UnlockRule />
        </Panel>
      </Dashboard>
    </>
  );
}
