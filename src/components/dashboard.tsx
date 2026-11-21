import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * The dashboard grid every screen is built from (build-plan.md "Screen layout system").
 * - Laptop (xl, ≥ 1280 px): 12 columns; each cell spans 3–12 columns.
 * - Tablet (md): 2 columns; wide cells (span ≥ 7) take the full row.
 * - Phone: 1 column, in source order (put the most important first).
 */

export type Span = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;

// Listed in full so Tailwind generates them.
const XL_SPAN: Record<Span, string> = {
  3: "xl:col-span-3",
  4: "xl:col-span-4",
  5: "xl:col-span-5",
  6: "xl:col-span-6",
  7: "xl:col-span-7",
  8: "xl:col-span-8",
  9: "xl:col-span-9",
  12: "xl:col-span-12",
};

export function spanClass(span: Span, fullOnTablet = span >= 7) {
  return cn(fullOnTablet && "md:col-span-2", XL_SPAN[span]);
}

export function Dashboard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12 xl:gap-5", className)}
    >
      {children}
    </div>
  );
}

/** A grid cell without card styling (e.g. for a stat tile, which is its own card). */
export function Cell({
  span = 12,
  fullOnTablet,
  className,
  children,
}: {
  span?: Span;
  fullOnTablet?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("min-w-0", spanClass(span, fullOnTablet), className)}>{children}</div>;
}

interface PanelProps {
  span?: Span;
  fullOnTablet?: boolean;
  title?: string;
  subtitle?: ReactNode;
  /** Shown in the top-right corner of the card. */
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** For in-page links, e.g. "#health-plan". */
  id?: string;
  /** Marks the card for the page tour (`data-tour`). */
  tour?: string;
  children: ReactNode;
}

/** A dashboard card: white, rounded, with an optional title, subtitle and action. */
export function Panel({
  span = 12,
  fullOnTablet,
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  id,
  tour,
  children,
}: PanelProps) {
  // The title names the card, so screen readers can jump to e.g. "What you did today".
  const titleId = useId();
  return (
    <section
      id={id}
      data-tour={tour}
      aria-labelledby={title ? titleId : undefined}
      className={cn(
        "min-w-0 rounded-2xl border bg-card p-5 text-card-foreground",
        spanClass(span, fullOnTablet),
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
