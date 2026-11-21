"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";
import { isActive, isMoreActive, MORE_TAB, TAB_ITEMS } from "./nav";

/** Bottom tab bar for phone widths (below md): 4 main screens + More. */
export function BottomTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const tabs = [
    ...TAB_ITEMS.map((t) => ({ ...t, active: isActive(t.href, pathname) })),
    { ...MORE_TAB, active: isMoreActive(pathname) },
  ];

  return (
    <nav
      aria-label={copy.common.mainNav}
      className={cn(
        "border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground",
        className,
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map(({ href, label, icon: Icon, active }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none focus-visible:bg-sidebar-accent",
                active ? "text-sidebar-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-sidebar-accent",
                )}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
