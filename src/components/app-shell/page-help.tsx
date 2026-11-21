"use client";

import { Info } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";
import { useTourStore, type TourPage } from "@/stores/tour-store";

/** Which tour belongs to which screen. Screens not listed here get no ⓘ. */
const TOUR_BY_PATH: Record<string, TourPage> = {
  "/": "today",
  "/habits": "habits",
  "/activities": "activities",
  "/reports": "reports",
  "/phases": "phases",
  "/health": "health",
  "/health/reports": "healthReports",
  "/settings": "settings",
};

/** The ⓘ button (icon only): starts the spotlight tour of the page you're on. */
export function PageHelpButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const startTour = useTourStore((s) => s.start);
  const page = TOUR_BY_PATH[pathname.replace(/\/$/, "") || "/"];
  if (!page) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={copy.help.button}
      onClick={() => startTour(page)}
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      <Info aria-hidden className="size-5" />
    </Button>
  );
}
