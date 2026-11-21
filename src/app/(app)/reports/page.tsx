import type { Metadata } from "next";
import { copy } from "@/copy";
import { ReportsScreen } from "@/features/reports/reports-screen";

export const metadata: Metadata = { title: copy.pages.reports.title };

export default function ReportsPage() {
  return <ReportsScreen />;
}
