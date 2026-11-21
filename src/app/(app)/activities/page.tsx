import type { Metadata } from "next";
import { copy } from "@/copy";
import { ActivitiesScreen } from "@/features/activities/activities-screen";

export const metadata: Metadata = { title: copy.pages.activities.title };

export default function ActivitiesPage() {
  return <ActivitiesScreen />;
}
