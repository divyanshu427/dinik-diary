"use client";

import { Info } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";
import { hasTour, useTourStore } from "@/stores/tour-store";

const h = copy.help;
type PageKey = keyof typeof h.pages;

/** Which help text belongs to which screen. Screens not listed here get no ⓘ. */
const PAGE_BY_PATH: Record<string, PageKey> = {
  "/": "today",
  "/habits": "habits",
  "/activities": "activities",
  "/reports": "reports",
  "/phases": "phases",
  "/health": "health",
  "/health/reports": "healthReports",
  "/settings": "settings",
};

/**
 * The ⓘ button (icon only). On pages with a spotlight tour it starts the tour; on the others it
 * opens a sheet: what the page is for, how it works, what changes what, where the data goes.
 */
export function PageHelpButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const startTour = useTourStore((s) => s.start);
  const key = PAGE_BY_PATH[pathname.replace(/\/$/, "") || "/"];
  if (!key) return null;
  const page = h.pages[key];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={h.button}
        aria-haspopup="dialog"
        // Pages with a tour start it; the others show their explanation as a sheet.
        onClick={() => (hasTour(key) ? startTour(key) : setOpen(true))}
        className={cn("text-muted-foreground hover:text-foreground", className)}
      >
        <Info aria-hidden className="size-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88dvh] gap-4 overflow-y-auto sm:max-w-lg">
          <div>
            <DialogTitle className="text-xl leading-tight">{page.title}</DialogTitle>
            <DialogDescription className="mt-1.5 text-base text-foreground">
              {page.purpose}
            </DialogDescription>
          </div>
          <Section title={h.sections.how} items={page.how} />
          <Section title={h.sections.change} items={page.change} />
          <div>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {h.sections.flow}
            </h3>
            <p className="text-sm">{page.flow}</p>
          </div>
          <Button variant="secondary" className="h-11 w-full" onClick={() => setOpen(false)}>
            {h.close}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
