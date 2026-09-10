/**
 * Re-export shared schedule helpers for Absences callers that still import the
 * historical path. Prefer `@shared/schedule` / `shared/schedule/public-api`.
 */
export {
  applyWorkingDayToggle,
  clearScheduleBreak,
  cloneSchedule,
  defaultSchedule,
  normalizeSchedulePayload,
} from '../../../../shared/schedule/schedule.util';
export type { ScheduleDay } from '../../../../shared/schedule/schedule.model';
