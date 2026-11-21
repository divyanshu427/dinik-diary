import { appIcon } from "@/brand/app-icon";

/** Browser tab and home-screen icons, generated from the brand settings at build time. */
export function generateImageMetadata() {
  return [
    { id: "32", size: { width: 32, height: 32 }, contentType: "image/png" },
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
    { id: "maskable", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const which = String(await id);
  return which === "maskable" ? appIcon(512, true) : appIcon(Number(which));
}
