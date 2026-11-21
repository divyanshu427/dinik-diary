import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  /** Small line above the title: a date or a summary ("10 active habits, 30 more waiting"). */
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  /** Small link above the title, e.g. "Back to Today". */
  back?: { href: string; label: string };
  /** Controls on the right, e.g. a Week / Month / All time switch. */
  actions?: ReactNode;
  className?: string;
}

/** Title block at the top of every screen. */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  back,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="mb-1 text-sm text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
