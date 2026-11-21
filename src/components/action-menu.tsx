"use client";

import { ChevronLeft, ChevronRight, Ellipsis, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copy } from "@/copy";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export interface ActionItem {
  label: string;
  /** One line under the label in the phone sheet ("Name, target, how often"). */
  description?: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Draws a line above this item. */
  separatorBefore?: boolean;
  /** Choosing this item shows these instead (e.g. which phase to move to). */
  children?: ActionItem[];
  /** Read out after the label, e.g. "(locked)". */
  srNote?: string;
}

interface ActionMenuProps {
  /** The trigger button's accessible name, e.g. "Actions for Bath". */
  label: string;
  /** Sheet heading on phones (the item's name). */
  title: string;
  /** Under the heading, e.g. "Phase 1 · Morning · 50%". */
  subtitle?: ReactNode;
  items: ActionItem[];
  /** The trigger icon (⋯ by default). */
  icon?: LucideIcon;
  triggerClassName?: string;
}

/**
 * A "⋯" menu: a dropdown on wider screens, a bottom sheet with descriptions on phones.
 * Items are menu items in both, so they're found and announced the same way.
 */
export function ActionMenu(props: ActionMenuProps) {
  const phone = useMediaQuery(PHONE_QUERY);
  return phone ? <ActionSheet {...props} /> : <ActionDropdown {...props} />;
}

function Trigger({
  label,
  icon: Icon = Ellipsis,
  className,
  ...rest
}: { label: string; icon?: LucideIcon; className?: string } & React.ComponentProps<"button">) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} className={className} {...rest}>
      <Icon aria-hidden />
    </Button>
  );
}

function ActionDropdown({ label, items, icon, triggerClassName }: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Trigger label={label} icon={icon} className={triggerClassName} />}
      />
      <DropdownMenuContent align="end" className="w-auto min-w-52">
        {items.map((item) => (
          <DropdownEntry key={item.label} item={item} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownEntry({ item }: { item: ActionItem }) {
  const Icon = item.icon;
  const content = (
    <>
      {Icon && <Icon aria-hidden />}
      {item.label}
      {item.srNote && <span className="sr-only"> ({item.srNote})</span>}
    </>
  );
  return (
    <>
      {item.separatorBefore && <DropdownMenuSeparator />}
      {item.children ? (
        // Click to open (not hover), so a click never closes a submenu that hover just opened.
        <DropdownMenuSub>
          <DropdownMenuSubTrigger openOnHover={false} disabled={item.disabled}>
            {content}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-56">
            {item.children.map((child) => (
              <DropdownEntry key={child.label} item={child} />
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : (
        <DropdownMenuItem
          variant={item.destructive ? "destructive" : "default"}
          disabled={item.disabled}
          onClick={item.onSelect}
        >
          {content}
        </DropdownMenuItem>
      )}
    </>
  );
}

function ActionSheet({ label, title, subtitle, items, icon, triggerClassName }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  /** The item whose choices are showing (e.g. "Move to another phase"), or null for the top. */
  const [step, setStep] = useState<ActionItem | null>(null);
  const list = step?.children ?? items;

  const choose = (item: ActionItem) => {
    if (item.disabled) return;
    if (item.children) {
      setStep(item);
      return;
    }
    setOpen(false);
    item.onSelect?.();
  };

  return (
    <>
      <Trigger
        label={label}
        icon={icon}
        className={triggerClassName}
        aria-haspopup="dialog"
        onClick={() => {
          setStep(null);
          setOpen(true);
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="gap-2">
          <div className="border-b pb-3">
            {step ? (
              <button
                type="button"
                onClick={() => setStep(null)}
                className="-ml-1 flex items-center gap-1 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronLeft aria-hidden className="size-5" />
                <DialogTitle>{step.label}</DialogTitle>
              </button>
            ) : (
              <DialogTitle>{title}</DialogTitle>
            )}
            {subtitle && !step ? (
              <DialogDescription render={<div />} className="mt-1">
                {subtitle}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{label}</DialogDescription>
            )}
          </div>
          <div role="menu" aria-label={step?.label ?? title} className="flex flex-col">
            {list.map((item) => (
              <SheetEntry key={item.label} item={item} onChoose={choose} />
            ))}
          </div>
          <DialogClose
            render={<Button variant="secondary" className="mt-2 h-12 w-full text-base" />}
          >
            {copy.common.cancel}
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SheetEntry({
  item,
  onChoose,
}: {
  item: ActionItem;
  onChoose: (item: ActionItem) => void;
}) {
  const descId = useId();
  const Icon = item.icon;
  return (
    <>
      {item.separatorBefore && <div role="separator" className="my-1 border-t" />}
      <button
        type="button"
        role="menuitem"
        aria-disabled={item.disabled || undefined}
        aria-describedby={item.description ? descId : undefined}
        onClick={() => onChoose(item)}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-xl px-2 py-3 text-left outline-none focus-visible:bg-muted active:bg-muted",
          item.disabled && "opacity-50",
          item.destructive ? "text-destructive" : "text-foreground",
        )}
      >
        {Icon && <Icon aria-hidden className="size-5 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium">
            {item.label}
            {item.srNote && <span className="sr-only"> ({item.srNote})</span>}
          </span>
          {item.description && (
            <span id={descId} className="block text-sm text-muted-foreground">
              {item.description}
            </span>
          )}
        </span>
        {item.children && <ChevronRight aria-hidden className="size-4 text-muted-foreground" />}
      </button>
    </>
  );
}
