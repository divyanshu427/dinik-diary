import type { Metadata } from "next";
import { copy } from "@/copy";
import { HabitsScreen } from "@/features/habits/habits-screen";

export const metadata: Metadata = { title: copy.pages.habits.title };

export default function HabitsPage() {
  return <HabitsScreen />;
}
