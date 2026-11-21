import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./ui-store";

const initial = useUiStore.getState();

describe("ui store", () => {
  beforeEach(() => useUiStore.setState(initial, true));

  it("starts on today with no dialog open", () => {
    const s = useUiStore.getState();
    expect(s.selectedDate).toBeNull();
    expect(s.openDialog).toBeNull();
  });

  it("selects a date and goes back to today", () => {
    useUiStore.getState().setSelectedDate("2026-11-18");
    expect(useUiStore.getState().selectedDate).toBe("2026-11-18");
    useUiStore.getState().resetToToday();
    expect(useUiStore.getState().selectedDate).toBeNull();
  });

  it("opens and closes one dialog at a time", () => {
    const s = useUiStore.getState();
    s.openDialogById("add-activity");
    expect(useUiStore.getState().openDialog).toBe("add-activity");
    s.openDialogById("add-habit");
    expect(useUiStore.getState().openDialog).toBe("add-habit");
    s.closeDialog();
    expect(useUiStore.getState().openDialog).toBeNull();
  });
});
