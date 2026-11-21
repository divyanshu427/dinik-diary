"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { fieldAria, FormField } from "@/components/form-field";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import type { ActivityDraft } from "@/data/activity-ops";
import type { Category } from "@/data/schema";
import { activityFormSchema, formToActivityDraft, type ActivityFormValues } from "./activity-form";

const f = copy.pages.activities.form;
const SCALE = (["", "1", "2", "3", "4", "5"] as const).map((value) => ({
  value,
  label: value || f.none,
}));

interface ActivityFormDialogProps {
  mode: "create" | "edit";
  initial: ActivityFormValues;
  categories: readonly Category[];
  /** Earlier subcategories per category, offered as suggestions. */
  subcategories: ReadonlyMap<string, string[]>;
  onSubmit: (draft: ActivityDraft) => Promise<unknown>;
  onClose: () => void;
}

/** Log or edit an activity. Mounted only while open. */
export function ActivityFormDialog({
  mode,
  initial,
  categories,
  subcategories,
  onSubmit,
  onClose,
}: ActivityFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasDetails = Boolean(
    initial.mood || initial.energy || initial.spend || initial.tags || initial.notes,
  );
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: initial,
  });
  const categoryId = useWatch({ control, name: "categoryId" });
  const err = (name: keyof ActivityFormValues) => errors[name]?.message;

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(formToActivityDraft(values));
      onClose();
    } catch (e) {
      setSubmitError(copy.pages.activities.failed(e instanceof Error ? e.message : String(e)));
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? f.addTitle : f.editTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField label={f.title} htmlFor="act-title" error={err("title")}>
            <Input
              {...register("title")}
              {...fieldAria("act-title", err("title"))}
              placeholder={f.titlePlaceholder}
              autoComplete="off"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={f.category} htmlFor="act-category" error={err("categoryId")}>
              <NativeSelect
                {...register("categoryId")}
                {...fieldAria("act-category", err("categoryId"))}
                className="w-full"
              >
                <NativeSelectOption value="" disabled>
                  {f.none}
                </NativeSelectOption>
                {categories.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={f.subcategory} htmlFor="act-subcategory">
              <Input
                {...register("subcategory")}
                id="act-subcategory"
                list="act-subcategory-options"
                placeholder={f.subcategoryPlaceholder}
                autoComplete="off"
              />
              <datalist id="act-subcategory-options">
                {(subcategories.get(categoryId) ?? []).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FormField
              label={f.date}
              htmlFor="act-date"
              error={err("date")}
              className="col-span-2 sm:col-span-1"
            >
              <Input {...register("date")} {...fieldAria("act-date", err("date"))} type="date" />
            </FormField>
            <FormField label={f.start} htmlFor="act-start" error={err("startTime")}>
              <Input
                {...register("startTime")}
                {...fieldAria("act-start", err("startTime"))}
                type="time"
              />
            </FormField>
            <FormField label={f.end} htmlFor="act-end" error={err("endTime")}>
              <Input
                {...register("endTime")}
                {...fieldAria("act-end", err("endTime"))}
                type="time"
              />
            </FormField>
            <FormField label={f.duration} htmlFor="act-duration" error={err("durationMinutes")}>
              <Input
                {...register("durationMinutes")}
                {...fieldAria("act-duration", err("durationMinutes"))}
                type="number"
                inputMode="numeric"
                min={0}
              />
            </FormField>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{f.timeHint}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={f.place} htmlFor="act-place">
              <Input {...register("place")} id="act-place" autoComplete="off" />
            </FormField>
            <FormField label={f.people} htmlFor="act-people">
              <Input {...register("people")} id="act-people" autoComplete="off" />
            </FormField>
          </div>

          <details open={hasDetails} className="group rounded-xl border px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">{f.more}</summary>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={`${f.mood} (${f.scale})`}>
                  <Controller
                    control={control}
                    name="mood"
                    render={({ field }) => (
                      <SegmentedControl
                        label={f.mood}
                        options={SCALE}
                        value={field.value}
                        onChange={field.onChange}
                        className="flex w-full [&>button]:flex-1 [&>button]:px-0"
                      />
                    )}
                  />
                </FormField>
                <FormField label={`${f.energy} (${f.scale})`}>
                  <Controller
                    control={control}
                    name="energy"
                    render={({ field }) => (
                      <SegmentedControl
                        label={f.energy}
                        options={SCALE}
                        value={field.value}
                        onChange={field.onChange}
                        className="flex w-full [&>button]:flex-1 [&>button]:px-0"
                      />
                    )}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={f.spend} htmlFor="act-spend" error={err("spend")}>
                  <Input
                    {...register("spend")}
                    {...fieldAria("act-spend", err("spend"))}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                  />
                </FormField>
                <FormField label={f.tags} htmlFor="act-tags">
                  <Input
                    {...register("tags")}
                    id="act-tags"
                    placeholder={f.tagsPlaceholder}
                    autoComplete="off"
                  />
                </FormField>
              </div>
              <FormField label={f.notes} htmlFor="act-notes">
                <Textarea {...register("notes")} id="act-notes" rows={2} />
              </FormField>
            </div>
          </details>

          {submitError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {submitError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {f.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {mode === "create" ? f.create : f.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
