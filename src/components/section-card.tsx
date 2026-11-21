import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

/** White rounded card with a heading, used for each block on a screen. */
export function SectionCard({ title, subtitle, children, className }: SectionCardProps) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 text-card-foreground", className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
