import type { Metadata } from "next";
import { copy } from "@/copy";
import { PhasesScreen } from "@/features/phases/phases-screen";

export const metadata: Metadata = { title: copy.pages.phases.title };

export default function PhasesPage() {
  return <PhasesScreen />;
}
