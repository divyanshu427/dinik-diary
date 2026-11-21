import { create } from "zustand";

/**
 * App-wide UI state that isn't data (data lives in the database + TanStack Query from Build Phase 3).
 * - selectedDate: the day being viewed on Today. null means "today" (worked out with the
 *   4 AM rule in Build Phase 4), so the app never shows a stale date after midnight.
 * - openDialog: which dialog is open, so any screen or shortcut can open/close it.
 */
export type DialogId = "add-activity" | "add-habit" | "edit-habit" | "edit-activity";

/** A calendar day as "YYYY-MM-DD". */
export type IsoDate = string;

interface UiState {
  selectedDate: IsoDate | null;
  openDialog: DialogId | null;
  setSelectedDate: (date: IsoDate | null) => void;
  resetToToday: () => void;
  openDialogById: (id: DialogId) => void;
  closeDialog: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  selectedDate: null,
  openDialog: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  resetToToday: () => set({ selectedDate: null }),
  openDialogById: (id) => set({ openDialog: id }),
  closeDialog: () => set({ openDialog: null }),
}));
