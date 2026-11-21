/* Reading and opening report files (photos and PDFs) in the browser. */

/** Photos and PDFs only. */
export const isAcceptedFile = (file: { type: string }) =>
  file.type.startsWith("image/") || file.type === "application/pdf";

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Opens a saved file in a new tab. Browsers block opening data: URLs directly, so it's turned
 * into a temporary blob: URL first.
 */
export async function openDataUrl(data: string) {
  const blob = await (await fetch(data)).blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const sizeFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

/** 1536 → "1.5 KB", 2_400_000 → "2.3 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
  return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}
