"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";

const t = copy.pages.today.note;

/** A short note on a check-in, e.g. "Guava" for breakfast. Mounted only while open. */
export function NoteDialog({
  habitName,
  initial,
  onSave,
  onClose,
}: {
  habitName: string;
  initial: string;
  onSave: (note: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [note, setNote] = useState(initial);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(note);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title(habitName)}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="checkin-note">{t.label}</Label>
            <Textarea
              id="checkin-note"
              value={note}
              maxLength={200}
              rows={2}
              placeholder={t.placeholder}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
