import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  /** Small label, e.g. "Coming in Build Phase 6". */
  badge?: string;
  children?: ReactNode;
  className?: string;
}

/** Friendly placeholder for a screen or list with nothing to show yet. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  badge,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {body && <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>}
      {badge && (
        <Badge variant="secondary" className="mt-4">
          {badge}
        </Badge>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
