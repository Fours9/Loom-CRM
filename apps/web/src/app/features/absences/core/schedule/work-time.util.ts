import { ScheduleDay } from '../api/models';

export function weekdayFromIsoDate(isoDate: string): number {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return 0;
  }
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

export function parseTimeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Нормалізує HH:MM або HH:MM:SS → HH:MM */
export function normalizeHm(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 5);
}

export function shiftBoundsForDate(
  schedule: ScheduleDay[],
  isoDate: string,
): { start: string; end: string } | null {
  if (!isoDate) return null;
  const weekday = weekdayFromIsoDate(isoDate);
  const day = schedule.find((d) => d.weekday === weekday);
  if (!day?.isWorkingDay || !day.startTime || !day.endTime) {
    return null;
  }
  return {
    start: normalizeHm(day.startTime),
    end: normalizeHm(day.endTime),
  };
}

/** Усі мітки часу в межах зміни з кроком (включно з кінцем зміни). */
export function timeOptionsInShift(
  startHm: string,
  endHm: string,
  stepMinutes = 15,
): string[] {
  const a = parseTimeToMinutes(startHm);
  const b = parseTimeToMinutes(endHm);
  if (a >= b) return [];
  const out: string[] = [];
  for (let t = a; t <= b; t += stepMinutes) {
    out.push(formatMinutes(t));
  }
  const end = formatMinutes(b);
  if (out[out.length - 1] !== end) {
    out.push(end);
  }
  return out;
}
