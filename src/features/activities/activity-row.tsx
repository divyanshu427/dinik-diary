"use client";

import { Copy, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { ActionMenu, type ActionItem } from "@/components/action-menu";
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
      <span className="w-[4.25rem] shrink-0 pt-0.5 text-sm whitespace-nowrap text-muted-foreground tabular-nums sm:w-[4.75rem]">
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
        {details && <span className="block text-sm text-muted-foreground">{details}</span>}
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

/** The ⋮ menu of an entry: edit, copy to today, delete (a bottom sheet on phones). */
export function ActivityMenu({
  activity: a,
  onEdit,
  onDelete,
  onDuplicate,
}: Pick<ActivityRowProps, "activity" | "onEdit" | "onDelete" | "onDuplicate">) {
  const items: ActionItem[] = [
    {
      label: t.actions.edit,
      description: t.actions.editHint,
      icon: Pencil,
      onSelect: () => onEdit(a),
    },
    ...(onDuplicate
      ? [
          {
            label: t.actions.duplicate,
            description: t.actions.duplicateHint,
            icon: Copy,
            onSelect: () => onDuplicate(a),
          },
        ]
      : []),
    {
      label: t.actions.delete,
      description: t.actions.deleteHint,
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      onSelect: () => onDelete(a),
    },
  ];
  return (
    <ActionMenu
      label={t.actions.more(a.title)}
      title={a.title}
      subtitle={[
        a.startTime ? formatClock(a.startTime) : t.noTime,
        a.durationMinutes != null ? formatDuration(a.durationMinutes) : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      icon={EllipsisVertical}
      items={items}
    />
  );
}
