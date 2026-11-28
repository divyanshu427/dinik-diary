import { FILE_TABLE } from "./tables";

/** JSON with keys sorted, so the same row always gives the same text. */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
    .join(",")}}`;
}

/** FNV-1a, 2 × 32 bits: fast, and plenty to tell "changed" from "the same". */
function fnv(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/**
 * A short fingerprint of a row: if it differs from the one saved at the last sync, the row
 * changed on this device. A report file's contents are summarised (size and ending) so a
 * large photo isn't read in full on every sync; file contents never change once saved.
 */
export function hashRow(table: string, row: Record<string, unknown>): string {
  if (table === FILE_TABLE && typeof row.data === "string") {
    const data = row.data;
    return fnv(stable({ ...row, data: `${data.length}:${data.slice(-48)}` }));
  }
  return fnv(stable(row));
}
