"use client";

import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { copy } from "@/copy";
import type { Activity, Category } from "@/data/schema";
import { useActivityEditor } from "@/hooks/use-activities";
import type { IsoDate } from "@/lib/core";
import { activityToForm, emptyActivityForm, type ActivityFormValues } from "./activity-form";
import { ActivityFormDialog } from "./activity-form-dialog";

const t = copy.pages.activities;

/** Fields to start a new entry with, e.g. the start and end of a gap. */
export type ActivityPrefill = Partial<Pick<ActivityFormValues, "startTime" | "endTime">>;

type FormState =
  | { mode: "create"; date: IsoDate; prefill?: ActivityPrefill }
  | { mode: "edit"; activity: Activity }
  | null;

/**
 * Logging, editing, copying and deleting activities, with their dialogs.
 * Shared by the Today screen and the Activities screen. Render `dialogs` once on the page.
 */
export function useActivityActions(
  categories: readonly Category[],
  activities: readonly Activity[],
) {
  const editor = useActivityEditor();
  const [form, setForm] = useState<FormState>(null);
  const [toDelete, setToDelete] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Earlier subcategories per category, newest first, for suggestions. */
  const subcategories = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of [...activities].sort((x, y) => y.date.localeCompare(x.date))) {
      if (!a.subcategory) continue;
      const list = map.get(a.categoryId) ?? [];
      if (!list.includes(a.subcategory)) list.push(a.subcategory);
      map.set(a.categoryId, list);
    }
    return map;
  }, [activities]);

  const lastCategory = useMemo(
    () =>
      [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.categoryId ?? "",
    [activities],
  );

  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(t.failed(e instanceof Error ? e.message : String(e)));
    }
  };

  const editing = form?.mode === "edit" ? form.activity : null;
  const pickable = categories.filter((c) => !c.archived || c.id === editing?.categoryId);

  const dialogs = (
    <>
      {form && (
        <ActivityFormDialog
          mode={form.mode}
          initial={
            form.mode === "create"
              ? {
                  ...emptyActivityForm(
                    form.date,
                    pickable.some((c) => c.id === lastCategory) ? lastCategory : "",
                  ),
                  ...form.prefill,
                }
              : activityToForm(form.activity)
          }
          categories={pickable}
          subcategories={subcategories}
          onSubmit={(draft) =>
            form.mode === "create"
              ? editor.create.mutateAsync([draft])
              : editor.update.mutateAsync([form.activity.id, draft])
          }
          onClose={() => setForm(null)}
        />
      )}
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toDelete ? t.deleteTitle(toDelete.title) : ""}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const id = toDelete?.id;
                setToDelete(null);
                if (id) void run(() => editor.remove.mutateAsync([id]));
              }}
            >
              {t.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return {
    error,
    dialogs,
    logNew: (date: IsoDate, prefill?: ActivityPrefill) =>
      setForm({ mode: "create", date, prefill }),
    edit: (activity: Activity) => setForm({ mode: "edit", activity }),
    askDelete: (activity: Activity) => setToDelete(activity),
    duplicate: (activity: Activity, date: IsoDate) =>
      run(() => editor.duplicate.mutateAsync([activity.id, date])),
    repeatDay: (from: IsoDate, to: IsoDate) => run(() => editor.repeatDay.mutateAsync([from, to])),
    editor,
    run,
  };
}
