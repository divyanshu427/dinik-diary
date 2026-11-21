import { Inter, Space_Grotesk } from "next/font/google";

/**
 * Brand fonts. To change a font, swap the import and keep the `variable` names:
 * --font-display (headings, big numbers) and --font-body (everything else).
 */
export const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const fontVariables = `${displayFont.variable} ${bodyFont.variable}`;
