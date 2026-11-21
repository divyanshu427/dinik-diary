"use client";

import { Copy, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copy } from "@/copy";
import type { Activity, Category } from "@/data/schema";
import { formatClock } from "@/features/today/format";
import { cn } from "@/lib/utils";
import { categoryColor, formatDuration } from "./summary";

const t = copy.pages.activities;

interface ActivityRowProps {
  activity: Activity;
  category: Category | undefined;
  onEdit: (a: Activity) => void;
  onDelete: (a: Activity) => void;
  /** Omit to hide "Copy to today" (e.g. when already viewing today). */
  onDuplicate?: (a: Activity) => void;
  compact?: boolean;
}

/** One entry: time · colour · title / category · subcategory · place · duration. */
export function ActivityRow({
  activity: a,
  category,
  onEdit,
  onDelete,
  onDuplicate,
  compact,
}: ActivityRowProps) {
  const details = [
    category?.name,
    a.subcategory,
    a.place,
    a.people.length ? a.people.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const time = a.startTime ? formatClock(a.startTime) : t.noTime;
  return (
    <li
      className={cn("flex items-start gap-3", compact ? "px-4 py-2.5" : "px-4 py-3")}
      data-activity={a.title}
    >
      {/* Laptop/tablet: a time column. Phones: the time goes in the line under the title. */}
      <span className="hidden w-[4.75rem] shrink-0 pt-0.5 text-sm whitespace-nowrap text-muted-foreground tabular-nums sm:block">
        {time}
      </span>
      <span
        aria-hidden
        className="mt-1.5 size-2.5 shrink-0 rounded-full"
        style={{ background: categoryColor(category) }}
      />
      <button
        type="button"
        onClick={() => onEdit(a)}
        className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="block font-medium">{a.title}</span>
        {(details || a.startTime) && (
          <span className="block text-sm text-muted-foreground">
            {a.startTime && (
              <span className="sm:hidden">
                {time}
                {details && " · "}
              </span>
            )}
            {details}
          </span>
        )}
        {!compact && a.tags.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {a.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </span>
        )}
      </button>
      <span
        className={cn(
          "shrink-0 pt-0.5 text-sm whitespace-nowrap tabular-nums",
          a.durationMinutes == null ? "font-medium text-warning" : "text-muted-foreground",
        )}
      >
        {a.durationMinutes == null ? t.durationMissing : formatDuration(a.durationMinutes)}
      </span>
      <ActivityMenu activity={a} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />
    </li>
  );
}

/** The ⋯ menu of an entry: edit, copy to today, delete. */
export function ActivityMenu({
  activity: a,
  onEdit,
  onDelete,
  onDuplicate,
}: Pick<ActivityRowProps, "activity" | "onEdit" | "onDelete" | "onDuplicate">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={t.actions.more(a.title)} />}
      >
        <Ellipsis aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        <DropdownMenuItem onClick={() => onEdit(a)}>
          <Pencil aria-hidden />
          {t.actions.edit}
        </DropdownMenuItem>
        {onDuplicate && (
          <DropdownMenuItem onClick={() => onDuplicate(a)}>
            <Copy aria-hidden />
            {t.actions.duplicate}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(a)}>
          <Trash2 aria-hidden />
          {t.actions.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
