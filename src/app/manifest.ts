import type { MetadataRoute } from "next";
import { iconColors } from "@/brand/app-icon";
import { brand } from "@/brand/brand.config";

/** The web app manifest (Build Phase 13): makes Dinik Diary installable, from the brand settings. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: iconColors.page,
    theme_color: iconColors.background,
    categories: ["health", "lifestyle", "productivity"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/" },
      { name: "Health check-in", url: "/health" },
      { name: "Reports", url: "/reports" },
    ],
  };
}
