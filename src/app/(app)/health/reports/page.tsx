import type { Metadata } from "next";
import { copy } from "@/copy";
import { ReportsScreen } from "@/features/health/reports-screen";

export const metadata: Metadata = { title: copy.pages.health.reports.title };

export default function HealthReportsPage() {
  return <ReportsScreen />;
}
