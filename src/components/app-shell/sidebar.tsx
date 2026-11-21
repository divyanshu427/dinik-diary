"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/brand/brand.config";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav";

/** Left sidebar for laptop/tablet widths (md and up). Shows every screen. */
export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const main = NAV_ITEMS.filter((i) => i.group === "main");
  const secondary = NAV_ITEMS.filter((i) => i.group === "secondary");

  return (
    <aside
      className={cn(
        "flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <Link href="/" className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
          {brand.monogram}
        </span>
        <span className="font-heading text-lg font-semibold tracking-tight">{brand.name}</span>
      </Link>
      <nav aria-label={copy.common.mainNav} className="flex flex-1 flex-col gap-6 px-3 pb-4">
        <NavList items={main} pathname={pathname} />
        <NavList items={secondary} pathname={pathname} />
      </nav>
    </aside>
  );
}

function NavList({ items, pathname }: { items: typeof NAV_ITEMS; pathname: string }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon aria-hidden className="size-4.5" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
