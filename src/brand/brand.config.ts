/**
 * Brand settings. Change these to re-brand the app.
 * - Colours live in src/theme/presets/ (one file per theme).
 * - Fonts are loaded in src/brand/fonts.ts (Next.js needs them imported statically).
 * - User-facing text lives in src/copy/en.ts.
 */
export const brand = {
  /** Full name, shown in headers and the browser tab. */
  name: "Dinik Diary",
  /** Short name for the phone home screen (PWA, Build Phase 13). */
  shortName: "Dinik",
  tagline: "Small steps, every day",
  description: "Track daily habits, activities and how your time is spent.",
  /** Monogram shown until a real logo exists. */
  monogram: "DD",
  /** Default theme preset id (see src/theme/presets). */
  defaultTheme: "sage",
  /** Default colour mode for first-time visitors. */
  defaultMode: "system" as "light" | "dark" | "system",
  /** Corner radius used by cards, buttons and inputs. */
  radius: "0.75rem",
  /** Used by the Telegram bot later (Build Phase 16). */
  botName: "Coach",
  botTone: "friendly, short, no guilt",
} as const;

export type Brand = typeof brand;
