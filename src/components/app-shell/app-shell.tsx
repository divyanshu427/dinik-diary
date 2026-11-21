import type { ReactNode } from "react";
import { copy } from "@/copy";
import { PwaRegister } from "@/components/pwa";
import { BottomTabs } from "./bottom-tabs";
import { PhoneBrand } from "./phone-brand";
import { DemoBanner } from "./demo-banner";
import { Sidebar } from "./sidebar";

/**
 * The frame around every screen:
 * - md and up: fixed sidebar on the left
 * - below md: the logo row above every page, and a fixed tab bar at the bottom
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <a
        href="#content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {copy.common.skipToContent}
      </a>
      <Sidebar className="fixed inset-y-0 left-0 z-30 hidden md:flex" />
      <div className="flex flex-1 flex-col md:pl-60">
        <DemoBanner />
        <main
          id="content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 md:pt-8 md:pb-10 lg:px-8"
        >
          <PhoneBrand />
          {children}
        </main>
      </div>
      <BottomTabs className="fixed inset-x-0 bottom-0 z-30 md:hidden" />
      <PwaRegister />
    </div>
  );
}
