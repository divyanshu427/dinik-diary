import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { copy } from "@/copy";

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  phase: number;
  actions?: ReactNode;
}

/** A screen that exists but isn't built yet: header + empty state saying which build phase fills it. */
export function PlaceholderPage({
  phase,
  emptyTitle,
  emptyBody,
  icon,
  ...header
}: PlaceholderPageProps) {
  return (
    <>
      <PageHeader {...header} />
      <EmptyState
        icon={icon}
        title={emptyTitle}
        body={emptyBody}
        badge={copy.common.comingIn(phase)}
      />
    </>
  );
}
