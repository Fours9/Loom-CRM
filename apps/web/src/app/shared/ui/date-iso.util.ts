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

/** Display SoT for UA date fields (questionnaires, absences, forms). */
export function formatIsoToUa(iso: string): string {
  if (!iso) return '';
  const { y, m, d } = parseIsoParts(iso);
  if (!y || !m || !d) return '';
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

/**
 * Parse typed UA / common separators into ISO date-only.
 * Accepts `дд.мм.рррр`, `дд/мм/рррр`, `дд-мм-рррр` (also 1-digit day/month).
 * Returns null when empty/invalid — never invents a date.
 */
export function parseUaDateToIso(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidCivilDate(year, month, day)) return null;
  return toIsoDate(year, month, day);
}

export function isValidCivilDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}
