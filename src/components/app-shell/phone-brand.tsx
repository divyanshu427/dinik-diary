import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/brand/brand.config";

/**
 * Phones only: the app's logo and name above every page's title (added once, by the app frame).
 * The right-hand slot is for the page help button.
 */
export function PhoneBrand({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
      <Link
        href="/"
        className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary font-heading text-sm font-bold text-primary-foreground">
          {brand.monogram}
        </span>
        <span className="font-heading text-lg leading-tight font-semibold tracking-tight">
          {brand.name}
        </span>
      </Link>
      {children && <div className="flex shrink-0 items-center">{children}</div>}
    </div>
  );
}
