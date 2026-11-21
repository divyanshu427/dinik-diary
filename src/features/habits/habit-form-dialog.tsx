"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { fieldAria, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import type { HabitDraft } from "@/data/habit-ops";
import { PART_OF_DAY, type Category, type Phase } from "@/data/schema";
import { cn } from "@/lib/utils";
import { habitFormSchema, formToDraft, type HabitFormValues } from "./habit-form";

const f = copy.pages.habits.form;
const TYPES = ["boolean", "count", "duration", "numeric", "time"] as const;
const SCHEDULES = ["daily", "weekdays", "timesPerWeek", "everyNDays"] as const;

interface HabitFormDialogProps {
  mode: "create" | "edit";
  initial: HabitFormValues;
  phases: readonly Phase[];
  categories: readonly Category[];
  /** Habit already has check-ins: type and goal direction can't change. */
  measurementLocked: boolean;
  onSubmit: (draft: HabitDraft) => Promise<unknown>;
  onClose: () => void;
}

/** Add or edit a habit. Mounted only while open, so it always starts from `initial`. */
export function HabitFormDialog({
  mode,
  initial,
  phases,
  categories,
  measurementLocked,
  onSubmit,
  onClose,
}: HabitFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<HabitFormValues>({ resolver: zodResolver(habitFormSchema), defaultValues: initial });

  const type = useWatch({ control, name: "type" });
  const scheduleKind = useWatch({ control, name: "scheduleKind" });
  const direction = useWatch({ control, name: "direction" });
  const isAmount = type === "count" || type === "duration" || type === "numeric";
  const targetTouched =
    mode === "edit" &&
    (dirtyFields.targetValue || dirtyFields.targetTime || dirtyFields.graceMinutes);

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(formToDraft(values));
      onClose();
    } catch (err) {
      setSubmitError(copy.pages.habits.failed(err instanceof Error ? err.message : String(err)));
    }
  });

  const err = (name: keyof HabitFormValues) => errors[name]?.message;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? f.addTitle : f.editTitle}</DialogTitle>
          {mode === "edit" && <DialogDescription>{f.targetChangeNote}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField label={f.name} htmlFor="habit-name" error={err("name")}>
            <Input
              {...register("name")}
              {...fieldAria("habit-name", err("name"))}
              placeholder={f.namePlaceholder}
              autoComplete="off"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={f.phase} htmlFor="habit-phase">
              <NativeSelect {...register("phaseId")} id="habit-phase" className="w-full">
                {phases.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {copy.pages.data.phaseLabel(p.number, p.name)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={f.category} htmlFor="habit-category">
              <NativeSelect {...register("categoryId")} id="habit-category" className="w-full">
                <NativeSelectOption value="">{f.noCategory}</NativeSelectOption>
                {categories
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </FormField>
          </div>

          {/* Locked fields are shown as text: their values stay in the form via defaultValues. */}
          {measurementLocked ? (
            <FormField label={f.type} hint={f.typeLocked}>
              <p className="text-sm">{f.types[type]}</p>
            </FormField>
          ) : (
            <FormField label={f.type} htmlFor="habit-type">
              <NativeSelect {...register("type")} id="habit-type" className="w-full">
                {TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {f.types[t]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          )}

          {isAmount && (
            <div className="grid grid-cols-[auto_1fr_1fr] gap-3">
              {measurementLocked ? (
                <FormField label={f.direction}>
                  <p className="flex h-8 items-center text-sm">{f.directions[direction]}</p>
                </FormField>
              ) : (
                <FormField label={f.direction} htmlFor="habit-direction">
                  <NativeSelect {...register("direction")} id="habit-direction">
                    <NativeSelectOption value="higher_better">
                      {f.directions.higher_better}
                    </NativeSelectOption>
                    <NativeSelectOption value="lower_better">
                      {f.directions.lower_better}
                    </NativeSelectOption>
                  </NativeSelect>
                </FormField>
              )}
              <FormField label={f.target} htmlFor="habit-target" error={err("targetValue")}>
                <Input
                  {...register("targetValue")}
                  {...fieldAria("habit-target", err("targetValue"))}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                />
              </FormField>
              {type === "duration" ? (
                <FormField label={f.unit}>
                  <p className="flex h-8 items-center text-sm text-muted-foreground">{f.minutes}</p>
                </FormField>
              ) : (
                <FormField label={f.unit} htmlFor="habit-unit">
                  <Input {...register("unit")} id="habit-unit" placeholder={f.unitPlaceholder} />
                </FormField>
              )}
            </div>
          )}

          {type === "time" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label={f.targetTime}
                htmlFor="habit-time"
                hint={f.targetTimeHint}
                error={err("targetTime")}
              >
                <Input
                  {...register("targetTime")}
                  {...fieldAria("habit-time", err("targetTime"), f.targetTimeHint)}
                  type="time"
                />
              </FormField>
              <FormField
                label={f.grace}
                htmlFor="habit-grace"
                hint={f.graceHint}
                error={err("graceMinutes")}
              >
                <Input
                  {...register("graceMinutes")}
                  {...fieldAria("habit-grace", err("graceMinutes"), f.graceHint)}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                />
              </FormField>
            </div>
          )}

          {targetTouched && <p className="text-xs text-muted-foreground">{f.targetChangeNote}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={f.schedule} htmlFor="habit-schedule">
              <NativeSelect {...register("scheduleKind")} id="habit-schedule" className="w-full">
                {SCHEDULES.map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {f.schedules[k]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={f.partOfDay} htmlFor="habit-part-of-day" hint={f.partOfDayHint}>
              <NativeSelect
                {...register("partOfDay")}
                {...fieldAria("habit-part-of-day", undefined, f.partOfDayHint)}
                className="w-full"
              >
                {PART_OF_DAY.map((p) => (
                  <NativeSelectOption key={p} value={p}>
                    {copy.pages.habits.partsOfDay[p]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          </div>

          {scheduleKind === "weekdays" && (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">{f.days}</legend>
              <div className="grid grid-cols-7 gap-1">
                {copy.pages.habits.weekdaysShort.map((day, i) => (
                  <label key={day} className="cursor-pointer">
                    <input
                      type="checkbox"
                      value={String(i)}
                      {...register("days")}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-8 w-full items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                        "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                        "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                      )}
                    >
                      {day}
                    </span>
                  </label>
                ))}
              </div>
              {err("days") && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {err("days")}
                </p>
              )}
            </fieldset>
          )}

          {scheduleKind === "timesPerWeek" && (
            <FormField label={f.timesPerWeek} htmlFor="habit-times" error={err("times")}>
              <Input
                {...register("times")}
                {...fieldAria("habit-times", err("times"))}
                type="number"
                inputMode="numeric"
                min={1}
                max={7}
                className="w-24"
              />
            </FormField>
          )}

          {scheduleKind === "everyNDays" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={f.every} htmlFor="habit-every" error={err("every")}>
                <Input
                  {...register("every")}
                  {...fieldAria("habit-every", err("every"))}
                  type="number"
                  inputMode="numeric"
                  min={2}
                />
              </FormField>
              <FormField label={f.startingFrom} htmlFor="habit-anchor" error={err("anchor")}>
                <Input
                  {...register("anchor")}
                  {...fieldAria("habit-anchor", err("anchor"))}
                  type="date"
                />
              </FormField>
            </div>
          )}

          <FormField label={f.description} htmlFor="habit-description">
            <Textarea {...register("description")} id="habit-description" rows={2} />
          </FormField>

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
