"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";

const t = copy.pages.health.tabs;
const TABS = [
  { href: "/health", label: t.overview },
  { href: "/health/reports", label: t.reports },
] as const;

/** Overview | Reports and values. */
export function HealthTabs() {
  const pathname = usePathname();
  return (
    <nav
      data-tour="health-tabs"
      aria-label={t.label}
      className="inline-flex gap-1 rounded-xl border bg-card p-1 max-md:col-span-2 max-md:flex max-md:w-full"
    >
      {TABS.map((tab) => {
        const current = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-md:h-10 max-md:flex-1",
              current ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
