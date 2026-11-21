import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MORE_ITEMS } from "@/components/app-shell/nav";
import { PageHeader } from "@/components/page-header";
import { copy } from "@/copy";

const p = copy.pages.more;

export const metadata: Metadata = { title: p.title };

/** Phone "More" tab: links to the screens that don't fit in the bottom bar. */
export default function MorePage() {
  return (
    <>
      <PageHeader title={p.title} subtitle={p.subtitle} />
      <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
        {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 px-4 py-4 transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
