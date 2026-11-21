import { ImageResponse } from "next/og";
import { getPreset } from "@/theme/presets";
import { brand } from "./brand.config";

/*
 * App icons (Build Phase 13), drawn from the brand settings: the monogram on the default
 * theme's primary colour. Change brand.config.ts or the theme preset and the icons follow.
 */

const theme = getPreset(brand.defaultTheme)!.light;

/** The theme colours the manifest and browser bar use. */
export const iconColors = {
  background: theme.primary,
  foreground: theme["primary-foreground"],
  page: theme.background,
};

/**
 * @param size  width and height in pixels
 * @param maskable  full-bleed square with the monogram inside the safe zone (Android adaptive
 *   icons crop to a circle or squircle); otherwise a rounded square.
 */
export function appIcon(size: number, maskable = false) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: iconColors.background,
        color: iconColors.foreground,
        borderRadius: maskable ? 0 : size * 0.22,
        fontSize: size * (maskable ? 0.34 : 0.44),
        fontWeight: 700,
        letterSpacing: -size * 0.01,
      }}
    >
      {brand.monogram}
    </div>,
    { width: size, height: size },
  );
}
