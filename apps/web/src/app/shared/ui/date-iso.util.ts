/** Date-only YYYY-MM-DD helpers — never use `new Date('YYYY-MM-DD')` (UTC shift). */

export function todayIsoLocal(): string {
  const d = new Date();
  return toIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseIsoParts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y: y || 0, m: m || 0, d: d || 0 };
}
