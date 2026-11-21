"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { brand } from "@/brand/brand.config";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";
import { isActive, isMoreActive, MORE_TAB, NAV_ITEMS, TAB_ITEMS } from "./nav";

const tabClass =
  "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none focus-visible:bg-sidebar-accent";

/** Bottom tab bar for phone widths (below md): 4 main screens + More (a sheet with every screen). */
export function BottomTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isMoreActive(pathname);

  return (
    <nav
      aria-label={copy.common.mainNav}
      className={cn(
        "border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground",
        className,
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(tabClass, active ? "text-sidebar-primary" : "text-muted-foreground")}
              >
                <TabIcon icon={Icon} active={active} />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? "page" : undefined}
            onClick={() => setMoreOpen(true)}
            className={cn(tabClass, moreActive ? "text-sidebar-primary" : "text-muted-foreground")}
          >
            <TabIcon icon={MORE_TAB.icon} active={moreActive} />
            {MORE_TAB.label}
          </button>
        </li>
      </ul>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} pathname={pathname} />
    </nav>
  );
}

function TabIcon({
  icon: Icon,
  active,
}: {
  icon: (typeof NAV_ITEMS)[number]["icon"];
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
        active && "bg-sidebar-accent",
      )}
    >
      <Icon aria-hidden className="size-5" />
    </span>
  );
}

/** The phone "More" sheet: every screen, main group first; tab screens are marked "Tab". */
function MoreSheet({
  open,
  onOpenChange,
  pathname,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
}) {
  const groups = [
    NAV_ITEMS.filter((i) => i.group === "main"),
    NAV_ITEMS.filter((i) => i.group === "secondary"),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3">
        <DialogTitle className="flex items-center gap-3 pr-10">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
            {brand.monogram}
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight">{brand.name}</span>
        </DialogTitle>
        <DialogDescription className="sr-only">{copy.pages.more.subtitle}</DialogDescription>
        <nav aria-label={copy.pages.more.title} data-testid="more-sheet">
          {groups.map((items, i) => (
            <ul key={i} className={cn("flex flex-col gap-0.5", i > 0 && "mt-2 border-t pt-2")}>
              {items.map(({ href, label, icon: Icon, placement }) => {
                const active = isActive(href, pathname);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      <Icon aria-hidden className="size-5 text-muted-foreground" />
                      <span className="flex-1">{label}</span>
                      {placement === "tab" && (
                        <span className="text-xs text-muted-foreground">
                          {copy.pages.more.tabHint}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
