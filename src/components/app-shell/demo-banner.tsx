"use client";

import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { switchToMyData } from "@/features/settings/demo-section";
import { useProfile } from "@/hooks/use-profile";

/** Shown on every screen while the demo profile is open. */
export function DemoBanner() {
  const profile = useProfile();
  if (profile !== "demo") return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-primary/30 bg-accent px-4 py-2 text-sm text-accent-foreground sm:px-6 lg:px-8"
    >
      <span className="flex items-center gap-2 font-medium">
        <FlaskConical aria-hidden className="size-4" />
        {copy.pages.demo.banner}
      </span>
      <Button size="sm" variant="outline" onClick={switchToMyData}>
        {copy.pages.demo.back}
      </Button>
    </div>
  );
}
