import { ScheduleDay } from '../api/models';
import { normalizeHm } from './work-time.util';

/** Стандартний графік Пн–Пт 09:00–18:00, перерва 13:00–14:00 (як на бекенді). */
export function defaultSchedule(): ScheduleDay[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const isWorkingDay = weekday <= 5;
    return {
      weekday,
      isWorkingDay,
      startTime: isWorkingDay ? '09:00' : null,
      endTime: isWorkingDay ? '18:00' : null,
      breakStart: isWorkingDay ? '13:00' : null,
      breakEnd: isWorkingDay ? '14:00' : null,
      note: null,
    };
  });
}

/** Копія графіка на 7 днів тижня для редагування. */
export function cloneSchedule(days: ScheduleDay[] | undefined): ScheduleDay[] {
  const byWeekday = new Map((days ?? []).map((d) => [d.weekday, d]));
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const existing = byWeekday.get(weekday);
    const isWorkingDay = existing?.isWorkingDay ?? weekday <= 5;
    return {
      weekday,
      isWorkingDay,
      startTime: isWorkingDay
        ? normalizeHm(existing?.startTime) || '09:00'
        : null,
      endTime: isWorkingDay
        ? normalizeHm(existing?.endTime) || '18:00'
        : null,
      breakStart: isWorkingDay ? normalizeHm(existing?.breakStart) || null : null,
      breakEnd: isWorkingDay ? normalizeHm(existing?.breakEnd) || null : null,
      note: existing?.note ?? null,
    };
  });
}

export function applyWorkingDayToggle(
  day: ScheduleDay,
  isWorkingDay: boolean,
): void {
  day.isWorkingDay = isWorkingDay;
  if (isWorkingDay) {
    day.startTime = normalizeHm(day.startTime) || '09:00';
    day.endTime = normalizeHm(day.endTime) || '18:00';
    // Перерва необов’язкова — не підставляємо значення за замовчуванням.
  } else {
    day.startTime = null;
    day.endTime = null;
    day.breakStart = null;
    day.breakEnd = null;
  }
}

export function clearScheduleBreak(day: ScheduleDay): void {
  day.breakStart = null;
  day.breakEnd = null;
}

/** Нормалізація перед відправкою на API (create / putSchedule). */
export function normalizeSchedulePayload(days: ScheduleDay[]): ScheduleDay[] {
  return days.map((day) => {
    const breakStart =
      day.isWorkingDay && day.breakStart
        ? normalizeHm(day.breakStart) || null
        : null;
    const breakEnd =
      day.isWorkingDay && day.breakEnd
        ? normalizeHm(day.breakEnd) || null
        : null;
    const hasBreak = Boolean(breakStart && breakEnd);
    return {
      weekday: day.weekday,
      isWorkingDay: day.isWorkingDay,
      startTime: day.isWorkingDay
        ? normalizeHm(day.startTime) || '09:00'
        : null,
      endTime: day.isWorkingDay
        ? normalizeHm(day.endTime) || '18:00'
        : null,
      breakStart: hasBreak ? breakStart : null,
      breakEnd: hasBreak ? breakEnd : null,
      note: day.note,
    };
  });
}
