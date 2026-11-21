import type { Metadata } from "next";
import { copy } from "@/copy";
import { HealthScreen } from "@/features/health/health-screen";

export const metadata: Metadata = { title: copy.pages.health.title };

export default function HealthPage() {
  return <HealthScreen />;
}
