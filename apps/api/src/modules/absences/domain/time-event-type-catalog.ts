/**
 * Single source of TimeEvent type structure rules (API domain only).
 * Workflow concerns (roles, backdating, approval) live in WorkflowPolicy — not here.
 * Contracts expose metadata DTO shapes only; FE consumes GET /absences/metadata.
 *
 * @see docs/adr/0008-work-calendar-via-absences.md
 */

export type TimeEventCategory = 'absence' | 'work';

export type TimeEventDateMode = 'single_day' | 'date_range';

export type TimeEventTimeMode = 'none' | 'optional' | 'required';

export type TimeEventSchedulePolicy =
  | 'any'
  | 'scheduled_work_day'
  | 'scheduled_day_off';

export type TimeEventVisualKind =
  | 'absence'
  | 'partial_absence'
  | 'overtime'
  | 'business_trip'
  | 'extra_work_day';

export type TimeEventType =
  | 'day_off'
  | 'vacation'
  | 'sick_leave'
  | 'part_time'
  | 'overtime'
  | 'business_trip'
  | 'extra_work_day';

export type TimeEventTypeDefinition = {
  category: TimeEventCategory;
  dateMode: TimeEventDateMode;
  timeMode: TimeEventTimeMode;
  /** Legacy flag for day_off/vacation only — not a full HR leave taxonomy. */
  supportsUnpaid: boolean;
  schedulePolicy: TimeEventSchedulePolicy;
  visualKind: TimeEventVisualKind;
};

export const TIME_EVENT_TYPE_CATALOG = {
  day_off: {
    category: 'absence',
    dateMode: 'date_range',
    timeMode: 'none',
    supportsUnpaid: true,
    schedulePolicy: 'any',
    visualKind: 'absence',
  },
  vacation: {
    category: 'absence',
    dateMode: 'date_range',
    timeMode: 'none',
    supportsUnpaid: true,
    schedulePolicy: 'any',
    visualKind: 'absence',
  },
  sick_leave: {
    category: 'absence',
    dateMode: 'date_range',
    timeMode: 'none',
    supportsUnpaid: false,
    schedulePolicy: 'any',
    visualKind: 'absence',
  },
  part_time: {
    category: 'absence',
    dateMode: 'single_day',
    timeMode: 'required',
    supportsUnpaid: false,
    schedulePolicy: 'scheduled_work_day',
    visualKind: 'partial_absence',
  },
  overtime: {
    category: 'work',
    dateMode: 'single_day',
    timeMode: 'required',
    supportsUnpaid: false,
    schedulePolicy: 'any',
    visualKind: 'overtime',
  },
  business_trip: {
    category: 'work',
    dateMode: 'date_range',
    timeMode: 'none',
    supportsUnpaid: false,
    schedulePolicy: 'any',
    visualKind: 'business_trip',
  },
  extra_work_day: {
    category: 'work',
    dateMode: 'single_day',
    timeMode: 'optional',
    supportsUnpaid: false,
    schedulePolicy: 'scheduled_day_off',
    visualKind: 'extra_work_day',
  },
} as const satisfies Record<TimeEventType, TimeEventTypeDefinition>;

export const TIME_EVENT_TYPES = Object.keys(
  TIME_EVENT_TYPE_CATALOG,
) as TimeEventType[];

export const TIME_EVENT_TYPE_LABELS: Record<TimeEventType, string> = {
  day_off: 'Відгул',
  vacation: 'Відпустка',
  sick_leave: 'Лікарняний',
  part_time: 'Неповний день',
  overtime: 'Понаднормові',
  business_trip: 'Відрядження',
  extra_work_day: 'Робочий день поза графіком',
};

export function getTimeEventTypeDefinition(
  type: string,
): TimeEventTypeDefinition | null {
  if (type in TIME_EVENT_TYPE_CATALOG) {
    return TIME_EVENT_TYPE_CATALOG[type as TimeEventType];
  }
  return null;
}

export function isTimeEventType(value: string): value is TimeEventType {
  return value in TIME_EVENT_TYPE_CATALOG;
}

/** Full-day absence types that block work events on overlapping dates. */
export function isFullAbsenceType(type: TimeEventType): boolean {
  return (
    type === 'day_off' || type === 'vacation' || type === 'sick_leave'
  );
}

export function durationMinutesFromTimes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number | null {
  if (!startTime || !endTime) return null;
  const start = parseHhMm(startTime);
  const end = parseHhMm(endTime);
  if (start == null || end == null || end <= start) return null;
  return end - start;
}

export function parseHhMm(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
