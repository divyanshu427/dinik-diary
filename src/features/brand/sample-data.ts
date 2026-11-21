import type { HeatmapDay } from "@/components/charts/completion-heatmap";
import type { TimeSlice } from "@/components/charts/time-donut";

/** Sample numbers for the /brand preview only (from the November report mock-up). */

// Slices are listed in chart-slot order: the palette is checked for neighbouring pairs in this order.
export const sampleTimeSlices: TimeSlice[] = [
  { key: "sleep", label: "Sleep and rest", hours: 143, color: "chart-1" },
  { key: "meals", label: "Meals and food", hours: 26, color: "chart-2" },
  { key: "work", label: "Work and job search", hours: 60, color: "chart-3" },
  { key: "travel", label: "Travel and exploration", hours: 17, color: "chart-4" },
  { key: "learning", label: "Learning and study", hours: 35, color: "chart-5" },
  { key: "entertainment", label: "Entertainment", hours: 43, color: "chart-6" },
  { key: "fitness", label: "Fitness", hours: 13, color: "chart-7" },
  { key: "social", label: "Social and family", hours: 22, color: "chart-8" },
  { key: "other", label: "Other", hours: 13, color: "chart-other" },
  { key: "unlogged", label: "Unlogged", hours: 60, color: "chart-unlogged" },
];

const novemberPct = [62, 55, 70, 85, 88, 66, 30, 58, 84, 86, 64, 90, 61, 48, 52, 68, 82, 80];

export const sampleHeatmap = {
  monthLabel: "Nov",
  firstWeekday: 6, // 1 Nov 2026 is a Sunday
  today: 18,
  days: Array.from({ length: 30 }, (_, i): HeatmapDay => ({
    day: i + 1,
    pct: novemberPct[i] ?? null,
  })),
};

export const sampleStats = [
  { label: "Habit completion", value: "74%", note: "Up 6 points from October", tone: "positive" },
  {
    label: "Longest habit streak",
    value: "11 days",
    note: "Brush teeth — morning",
    tone: "neutral",
  },
  {
    label: "Reels and social media",
    value: "52 min/day",
    note: "Up 20% from October",
    tone: "warning",
  },
  { label: "Travel and exploration", value: "4 trips", note: "17 hours in total", tone: "neutral" },
] as const;
