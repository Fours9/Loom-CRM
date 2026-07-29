/**
 * Date-only YYYY-MM-DD helpers without timezone conversion via local Date parse.
 */

const ISO_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDateOnly(value: string): boolean {
  const match = ISO_YMD.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Calendar validity via UTC components only (no local TZ shift).
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

export function formatIsoDateOnlyUk(value: string): string {
  if (!isIsoDateOnly(value)) return value;
  const [y, m, d] = value.split('-');
  return `${d}.${m}.${y}`;
}

export type ParsedIsoDateOnly = { year: number; month: number; day: number };

export function parseIsoDateOnly(value: string): ParsedIsoDateOnly | null {
  if (!isIsoDateOnly(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}
