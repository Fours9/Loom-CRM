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
  return { y, m, d };
}

export function addDaysIso(iso: string, days: number): string {
  const { y, m, d } = parseIsoParts(iso);
  const dt = new Date(y, m - 1, d + days);
  return toIsoDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function startOfMonthIso(iso: string): string {
  const { y, m } = parseIsoParts(iso);
  return toIsoDate(y, m, 1);
}

export function endOfMonthIso(iso: string): string {
  const { y, m } = parseIsoParts(iso);
  const last = new Date(y, m, 0).getDate();
  return toIsoDate(y, m, last);
}

/** Monday-based week containing iso date. */
export function startOfWeekIso(iso: string): string {
  const { y, m, d } = parseIsoParts(iso);
  const dt = new Date(y, m - 1, d);
  const js = dt.getDay(); // 0 Sun
  const mondayOffset = js === 0 ? -6 : 1 - js;
  return addDaysIso(iso, mondayOffset);
}

export function endOfWeekIso(iso: string): string {
  return addDaysIso(startOfWeekIso(iso), 6);
}

export function formatUkDayLabel(iso: string): string {
  const { y, m, d } = parseIsoParts(iso);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('uk-UA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function monthTitleUk(iso: string): string {
  const { y, m } = parseIsoParts(iso);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
}

export function enumerateIso(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return out;
}

export function isValidCalendarHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}
