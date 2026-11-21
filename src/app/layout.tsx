import type { Metadata, Viewport } from "next";
import { iconColors } from "@/brand/app-icon";
import { brand } from "@/brand/brand.config";
import { fontVariables } from "@/brand/fonts";
import { buildThemeCss } from "@/theme/css";
import { buildThemeScript, DEFAULT_PREFERENCE } from "@/theme/preference";
import { PRESETS } from "@/theme/presets";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "default" },
};

/** Colours the phone's browser bar like the app. */
export const viewport: Viewport = {
  themeColor: iconColors.background,
};

const themeCss = `${buildThemeCss(PRESETS, brand.defaultTheme)}\n:root{--radius:${brand.radius};}`;
const themeScript = buildThemeScript();

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_PREFERENCE.preset}
      data-mode="light"
      className={`${fontVariables} h-full antialiased`}
      // The theme script changes data-theme/data-mode before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/*
          href + precedence makes this a React "hoisted" stylesheet: React finds it by its href
          instead of by position, so extensions that inject tags into <head> can't break hydration.
        */}
        <style href="dinik-theme-tokens" precedence="theme">
          {themeCss}
        </style>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/*
        Browser extensions often add attributes to <body> (e.g. jf-observer-attached) before React
        loads. This ignores attribute differences on <body> only; everything inside is still checked.
      */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
