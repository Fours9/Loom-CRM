import { bool, pick, strOrNull } from './coerce.mjs';

export function mapScheduleDay(row, loomId, loomEmployeeId) {
  const isWorking = bool(pick(row, 'is_working_day', 'isWorkingDay'), true);
  const isDayOffExplicit = pick(row, 'is_day_off', 'isDayOff');
  const isDayOff =
    isDayOffExplicit !== undefined && isDayOffExplicit !== null
      ? bool(isDayOffExplicit)
      : !isWorking;
  return {
    id: loomId,
    employee_id: loomEmployeeId,
    weekday: Number(pick(row, 'weekday')),
    start_time: strOrNull(pick(row, 'start_time', 'startTime')),
    end_time: strOrNull(pick(row, 'end_time', 'endTime')),
    is_day_off: isDayOff,
    is_working_day: !isDayOff,
    break_start: strOrNull(pick(row, 'break_start', 'breakStart')),
    break_end: strOrNull(pick(row, 'break_end', 'breakEnd')),
    note: strOrNull(pick(row, 'note')),
  };
}
