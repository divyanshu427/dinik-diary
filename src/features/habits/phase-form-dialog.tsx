"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { fieldAria, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import type { PhaseDraft } from "@/data/habit-ops";

const f = copy.pages.habits.phaseForm;

const schema = z.object({
  name: z.string().trim().min(1, f.nameRequired),
  description: z.string(),
});

interface PhaseFormDialogProps {
  mode: "create" | "edit";
  initial: PhaseDraft;
  onSubmit: (draft: PhaseDraft) => Promise<unknown>;
  onClose: () => void;
}

/** Add or rename a phase. */
export function PhaseFormDialog({ mode, initial, onSubmit, onClose }: PhaseFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PhaseDraft>({ resolver: zodResolver(schema), defaultValues: initial });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setSubmitError(copy.pages.habits.failed(err instanceof Error ? err.message : String(err)));
    }
  });

  const nameError = errors.name?.message;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? f.addTitle : f.editTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField label={f.name} htmlFor="phase-name" error={nameError}>
            <Input
              {...register("name")}
              {...fieldAria("phase-name", nameError)}
              placeholder={f.namePlaceholder}
              autoComplete="off"
            />
          </FormField>
          <FormField label={f.description} htmlFor="phase-description">
            <Textarea {...register("description")} id="phase-description" rows={2} />
          </FormField>
          {submitError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {submitError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.pages.habits.cancel}
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
