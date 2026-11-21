import {
  ChartPie,
  Ellipsis,
  HeartPulse,
  Layers,
  ListChecks,
  ListTodo,
  Palette,
  Settings,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import { copy } from "@/copy";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Laptop sidebar: "main" (top group) or "secondary" (second group). */
  group: "main" | "secondary";
  /** Phone: "tab" = in the bottom bar; "more" = in the More sheet (and on the More screen). */
  placement: "tab" | "more";
}

const n = copy.nav;

/** Every screen in the app, in sidebar order. Add a new screen here. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: n.today, icon: ListChecks, group: "main", placement: "tab" },
  { href: "/habits", label: n.habits, icon: ListTodo, group: "main", placement: "tab" },
  { href: "/activities", label: n.activities, icon: Shapes, group: "main", placement: "tab" },
  { href: "/reports", label: n.reports, icon: ChartPie, group: "main", placement: "tab" },
  // On phones Phases lives under More: Today shows the next-phase progress.
  { href: "/phases", label: n.phases, icon: Layers, group: "main", placement: "more" },
  // Day log (Stage 2) joins the main group and the phone tabs once it works.
  { href: "/health", label: n.health, icon: HeartPulse, group: "secondary", placement: "more" },
  { href: "/settings", label: n.settings, icon: Settings, group: "secondary", placement: "more" },
  { href: "/brand", label: n.brand, icon: Palette, group: "secondary", placement: "more" },
];

export const MORE_HREF = "/more";
export const MORE_TAB = { href: MORE_HREF, label: n.more, icon: Ellipsis } as const;

export const TAB_ITEMS = NAV_ITEMS.filter((i) => i.placement === "tab");
export const MORE_ITEMS = NAV_ITEMS.filter((i) => i.placement === "more");

/** True when `pathname` is this item's page or one of its sub-pages. "/" only matches exactly. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The phone "More" tab is active on the More screen and on every screen listed in the More sheet. */
export function isMoreActive(pathname: string): boolean {
  return isActive(MORE_HREF, pathname) || MORE_ITEMS.some((i) => isActive(i.href, pathname));
}
