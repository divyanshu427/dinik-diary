"use client";

import { Plus, Repeat, Shapes } from "lucide-react";
import Link from "next/link";
import { Panel } from "@/components/dashboard";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { useActivities } from "@/hooks/use-activities";
import { useCategories } from "@/hooks/use-data";
import { addDays, type IsoDate } from "@/lib/core";
import { ActivityRow } from "./activity-row";
import { byTimeOfDay } from "./summary";
import { useActivityActions } from "./use-activity-actions";

const t = copy.pages.today.activities;

/** "What you did today" on the Today screen: that day's activities, quick log, repeat yesterday. */
export function TodayActivities({ date, today }: { date: IsoDate; today: IsoDate }) {
  const activities = useActivities();
  const categories = useCategories();
  const actions = useActivityActions(categories.data ?? [], activities.data ?? []);
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]));

  const all = activities.data ?? [];
  const list = all.filter((a) => a.date === date).sort(byTimeOfDay);
  const previous = addDays(date, -1);
  const previousCount = all.filter((a) => a.date === previous).length;

  return (
    <Panel
      title={date === today ? t.title : t.titleOther}
      subtitle={list.length ? t.count(list.length) : undefined}
      action={
        <Button size="sm" onClick={() => actions.logNew(date)}>
          <Plus aria-hidden />
          {t.log}
        </Button>
      }
      className="overflow-hidden"
      bodyClassName="-mx-5 -mb-5 border-t"
    >
      {actions.error && (
        <p role="alert" className="px-5 pt-3 text-sm text-destructive">
          {actions.error}
        </p>
      )}
      {list.length === 0 ? (
        <EmptyState icon={Shapes} title={t.empty} className="rounded-none border-0 px-5 py-8">
          {previousCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => actions.repeatDay(previous, date)}>
              <Repeat aria-hidden />
              {t.repeatYesterday(previousCount)}
            </Button>
          )}
        </EmptyState>
      ) : (
        <ul className="divide-y">
          {list.map((a) => (
            <ActivityRow
              key={a.id}
              compact
              activity={a}
              category={categoryById.get(a.categoryId)}
              onEdit={actions.edit}
              onDelete={actions.askDelete}
              onDuplicate={date === today ? undefined : (x) => actions.duplicate(x, today)}
            />
          ))}
        </ul>
      )}
      <div className="border-t px-5 py-2.5">
        <Link
          href="/activities"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t.seeAll}
        </Link>
      </div>
      {actions.dialogs}
    </Panel>
  );
}
