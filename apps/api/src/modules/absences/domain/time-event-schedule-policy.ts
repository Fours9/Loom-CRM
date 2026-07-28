import { BadRequestException } from '@nestjs/common';
import {
  getTimeEventTypeDefinition,
  type TimeEventType,
} from './time-event-type-catalog';

export type ScheduleDayFlag = {
  weekday: number; // 1=Mon .. 7=Sun
  isWorkingDay: boolean;
};

/**
 * Enforces TypeCatalog.schedulePolicy against Organization weekly schedule.
 * Does not mutate schedule.
 */
export function assertSchedulePolicy(
  type: TimeEventType,
  date: string,
  schedule: ScheduleDayFlag[],
): void {
  const def = getTimeEventTypeDefinition(type);
  if (!def || def.schedulePolicy === 'any') return;

  const weekday = weekdayMon1(date);
  const day =
    schedule.find((d) => d.weekday === weekday) ??
    defaultDay(weekday);

  if (def.schedulePolicy === 'scheduled_work_day' && !day.isWorkingDay) {
    throw new BadRequestException({
      code: 'TIME_EVENT_SCHEDULE_REJECT',
      message:
        'Цей тип дозволений лише у запланований робочий день за графіком працівника',
    });
  }

  if (def.schedulePolicy === 'scheduled_day_off' && day.isWorkingDay) {
    throw new BadRequestException({
      code: 'TIME_EVENT_SCHEDULE_REJECT',
      message:
        'Робочий день поза графіком дозволений лише у запланований вихідний',
    });
  }
}

/** ISO date → 1=Mon .. 7=Sun (calendar date, not TZ-shifted). */
export function weekdayMon1(isoDate: string): number {
  const d = new Date(isoDate + 'T12:00:00');
  const js = d.getDay(); // 0=Sun
  return js === 0 ? 7 : js;
}

function defaultDay(weekday: number): ScheduleDayFlag {
  return { weekday, isWorkingDay: weekday <= 5 };
}
