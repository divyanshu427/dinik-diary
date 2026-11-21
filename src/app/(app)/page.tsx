import type { Metadata } from "next";
import { copy } from "@/copy";
import { TodayScreen } from "@/features/today/today-screen";

export const metadata: Metadata = { title: copy.pages.today.title };

export default function TodayPage() {
  return <TodayScreen />;
}
