/** Shared helpers for open/close entry parsing and display (admin + staff dashboards) */

/** Parse user input for open/close: "" or "-" → null, else parseInt. 0 is valid. */
export function parseOpenClose(s: string): number | null {
  const t = s.trim();
  if (t === '' || t === '-') return null;
  const n = parseInt(t, 10);
  return Number.isNaN(n) || n < 0 ? null : n;
}

/** Display value for open number: show number or "-" for null */
export function openDisplay(entry: { open_number?: number | null } | undefined): string {
  return entry?.open_number != null ? String(entry.open_number) : '-';
}

/** Display value for close number: show number or "-" for null */
export function closeDisplay(entry: { close_number?: number | null } | undefined): string {
  return entry?.close_number != null ? String(entry.close_number) : '-';
}
