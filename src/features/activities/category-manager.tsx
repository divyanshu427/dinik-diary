"use client";

import {
  Archive,
  ArchiveRestore,
  Combine,
  EllipsisVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActionMenu } from "@/components/action-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { copy } from "@/copy";
import type { CategoryDraft } from "@/data/activity-ops";
import type { Category, ColorToken } from "@/data/schema";
import { cn } from "@/lib/utils";
import { sage } from "@/theme/presets/sage";
import { CHART_TOKENS, tokenVar } from "@/theme/tokens";
import { categoryColor } from "./summary";

const t = copy.pages.activities.categories;
const COLOURS: ColorToken[] = [...CHART_TOKENS, "chart-other"];
/** Starting value for the custom colour picker (the theme's neutral grey). */
const DEFAULT_CUSTOM = sage.light["chart-other"];

interface CategoryManagerProps {
  categories: readonly Category[];
  /** Activities + habits using each category. */
  usage: ReadonlyMap<string, number>;
  /** Activities per category (shown as "3 entries"). */
  entries: ReadonlyMap<string, number>;
  onCreate: (draft: CategoryDraft) => Promise<unknown>;
  onUpdate: (id: string, draft: CategoryDraft) => Promise<unknown>;
  onArchive: (id: string, archived: boolean) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onMerge: (fromId: string, intoId: string) => Promise<unknown>;
}

type Dialogs =
  | { kind: "form"; category?: Category }
  | { kind: "merge"; category: Category }
  | { kind: "delete"; category: Category }
  | null;

export function CategoryManager(props: CategoryManagerProps) {
  const { categories, usage, entries } = props;
  const [dialog, setDialog] = useState<Dialogs>(null);
  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  // Used by activities or habits first; the rest are waiting to be used.
  const inUse = active.filter((c) => (usage.get(c.id) ?? 0) > 0);
  const unused = active.filter((c) => (usage.get(c.id) ?? 0) === 0);
  const group = (title: string, list: readonly Category[]) =>
    list.length > 0 && (
      <div>
        <p className="mb-1 flex justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span>{title}</span>
          <span className="tabular-nums">{list.length}</span>
        </p>
        <ul className="-mx-2 flex flex-col">
          {list.map((c) => (
            <CategoryItem
              key={c.id}
              category={c}
              entries={entries.get(c.id) ?? 0}
              onOpen={setDialog}
              onArchive={props.onArchive}
            />
          ))}
        </ul>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <Button
        className="max-md:h-12 max-md:rounded-xl max-md:text-base md:self-start"
        onClick={() => setDialog({ kind: "form" })}
      >
        <Plus aria-hidden />
        {t.add}
      </Button>
      {group(t.inUse, inUse)}
      {group(t.unused, unused)}
      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {t.archived(archived.length)}
          </summary>
          <ul className="-mx-2 mt-1 flex flex-col">
            {archived.map((c) => (
              <CategoryItem
                key={c.id}
                category={c}
                entries={entries.get(c.id) ?? 0}
                onOpen={setDialog}
                onArchive={props.onArchive}
              />
            ))}
          </ul>
        </details>
      )}

      {dialog?.kind === "form" && (
        <CategoryFormDialog
          category={dialog.category}
          onClose={() => setDialog(null)}
          onSave={(draft) =>
            dialog.category ? props.onUpdate(dialog.category.id, draft) : props.onCreate(draft)
          }
        />
      )}
      {dialog?.kind === "merge" && (
        <MergeDialog
          category={dialog.category}
          targets={active.filter((c) => c.id !== dialog.category.id)}
          onClose={() => setDialog(null)}
          onMerge={(intoId) => props.onMerge(dialog.category.id, intoId)}
        />
      )}
      <AlertDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <AlertDialogContent>
          {dialog?.kind === "delete" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.deleteTitle(dialog.category.name)}</AlertDialogTitle>
                <AlertDialogDescription>
                  {(usage.get(dialog.category.id) ?? 0) > 0 ? t.deleteInUse : t.deleteBody}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{copy.pages.activities.cancel}</AlertDialogCancel>
                {(usage.get(dialog.category.id) ?? 0) === 0 && (
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      const id = dialog.category.id;
                      setDialog(null);
                      void props.onDelete(id);
                    }}
                  >
                    {t.actions.delete}
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryItem({
  category: c,
  entries,
  onOpen,
  onArchive,
}: {
  category: Category;
  entries: number;
  onOpen: (d: Dialogs) => void;
  onArchive: CategoryManagerProps["onArchive"];
}) {
  const a = t.actions;
  return (
    <li
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60 max-md:py-2.5"
      data-category={c.name}
    >
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full"
        style={{ background: categoryColor(c) }}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm max-md:text-base",
          c.archived && "text-muted-foreground",
        )}
      >
        {c.name}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums max-md:text-sm">
        {t.entries(entries)}
      </span>
      <ActionMenu
        label={a.more(c.name)}
        title={c.name}
        subtitle={t.entries(entries)}
        icon={EllipsisVertical}
        items={[
          {
            label: a.edit,
            description: a.editHint,
            icon: Pencil,
            onSelect: () => onOpen({ kind: "form", category: c }),
          },
          ...(!c.archived
            ? [
                {
                  label: a.merge,
                  description: a.mergeHint,
                  icon: Combine,
                  onSelect: () => onOpen({ kind: "merge", category: c }),
                },
              ]
            : []),
          {
            label: c.archived ? a.restore : a.archive,
            description: c.archived ? a.restoreHint : a.archiveHint,
            icon: c.archived ? ArchiveRestore : Archive,
            onSelect: () => void onArchive(c.id, !c.archived),
          },
          {
            label: a.delete,
            description: a.deleteHint,
            icon: Trash2,
            destructive: true,
            separatorBefore: true,
            onSelect: () => onOpen({ kind: "delete", category: c }),
          },
        ]}
      />
    </li>
  );
}

function CategoryFormDialog({
  category,
  onSave,
  onClose,
}: {
  category?: Category;
  onSave: (draft: CategoryDraft) => Promise<unknown>;
  onClose: () => void;
}) {
  const f = t.form;
  const [name, setName] = useState(category?.name ?? "");
  const [token, setToken] = useState<ColorToken>(category?.colorToken ?? "chart-other");
  const [custom, setCustom] = useState<string | null>(category?.customColor ?? null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(f.nameRequired);
    try {
      await onSave({ name, colorToken: token, customColor: custom });
      onClose();
    } catch (err) {
      setError(copy.pages.activities.failed(err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? f.editTitle : f.addTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">{f.name}</Label>
            <Input
              id="cat-name"
              value={name}
              placeholder={f.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              autoComplete="off"
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{f.colour}</legend>
            <div role="radiogroup" aria-label={f.colour} className="flex flex-wrap gap-2">
              {COLOURS.map((c, i) => {
                const selected = !custom && token === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={c === "chart-other" ? f.other : f.slot(i + 1)}
                    onClick={() => {
                      setToken(c);
                      setCustom(null);
                    }}
                    className={cn(
                      "size-8 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected && "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                    )}
                    style={{ background: tokenVar(c) }}
                  />
                );
              })}
            </div>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="color"
                aria-label={f.custom}
                value={custom ?? DEFAULT_CUSTOM}
                onChange={(e) => setCustom(e.target.value.toUpperCase())}
                className="h-8 w-10 cursor-pointer rounded border bg-transparent"
              />
              {f.custom}
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.pages.activities.cancel}
            </Button>
            <Button type="submit">{f.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog({
  category,
  targets,
  onMerge,
  onClose,
}: {
  category: Category;
  targets: readonly Category[];
  onMerge: (intoId: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [into, setInto] = useState(targets[0]?.id ?? "");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.mergeTitle(category.name)}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t.mergeBody}</p>
        <div className="grid gap-1.5">
          <Label htmlFor="merge-into">{t.mergeInto}</Label>
          <NativeSelect
            id="merge-into"
            value={into}
            onChange={(e) => setInto(e.target.value)}
            className="w-full"
          >
            {targets.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {copy.pages.activities.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={!into}
            onClick={async () => {
              await onMerge(into);
              onClose();
            }}
          >
            {t.mergeConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
