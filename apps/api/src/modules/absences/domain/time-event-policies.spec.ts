import {
  durationMinutesFromTimes,
  TIME_EVENT_TYPE_CATALOG,
} from './time-event-type-catalog';
import { validateTimeEventCandidate } from './time-event-request-validator';
import { assertSchedulePolicy } from './time-event-schedule-policy';
import { checkTimeEventOverlap } from './time-event-overlap-policy';
import { buildTimeEventTypeMetadata } from './time-event-metadata';

describe('TIME_EVENT_TYPE_CATALOG', () => {
  it('includes MVP work types', () => {
    expect(TIME_EVENT_TYPE_CATALOG.overtime.category).toBe('work');
    expect(TIME_EVENT_TYPE_CATALOG.business_trip.timeMode).toBe('none');
    expect(TIME_EVENT_TYPE_CATALOG.extra_work_day.schedulePolicy).toBe(
      'scheduled_day_off',
    );
  });

  it('builds metadata from catalog only', () => {
    const meta = buildTimeEventTypeMetadata();
    expect(meta).toHaveLength(7);
    expect(meta.find((t) => t.value === 'overtime')?.visualKind).toBe('overtime');
  });
});

describe('validateTimeEventCandidate', () => {
  it('requires times for overtime', () => {
    expect(() =>
      validateTimeEventCandidate({
        type: 'overtime',
        startDate: '2026-08-01',
      }),
    ).toThrow();
  });

  it('normalizes overtime duration inputs', () => {
    const c = validateTimeEventCandidate({
      type: 'overtime',
      startDate: '2026-08-01',
      startTime: '18:00',
      endTime: '21:00',
    });
    expect(c.endDate).toBeNull();
    expect(durationMinutesFromTimes(c.startTime, c.endTime)).toBe(180);
  });

  it('rejects unpaid on work types', () => {
    expect(() =>
      validateTimeEventCandidate({
        type: 'business_trip',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        isUnpaid: true,
      }),
    ).toThrow();
  });

  it('strips times for business_trip', () => {
    const c = validateTimeEventCandidate({
      type: 'business_trip',
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      startTime: '09:00',
      endTime: '18:00',
    });
    expect(c.startTime).toBeNull();
    expect(c.endTime).toBeNull();
  });
});

describe('assertSchedulePolicy', () => {
  const week = [
    { weekday: 1, isWorkingDay: true },
    { weekday: 2, isWorkingDay: true },
    { weekday: 3, isWorkingDay: true },
    { weekday: 4, isWorkingDay: true },
    { weekday: 5, isWorkingDay: true },
    { weekday: 6, isWorkingDay: false },
    { weekday: 7, isWorkingDay: false },
  ];

  it('rejects extra_work_day on scheduled workday', () => {
    // 2026-08-03 is Monday
    expect(() =>
      assertSchedulePolicy('extra_work_day', '2026-08-03', week),
    ).toThrow();
  });

  it('allows extra_work_day on scheduled day off', () => {
    // 2026-08-01 is Saturday
    expect(() =>
      assertSchedulePolicy('extra_work_day', '2026-08-01', week),
    ).not.toThrow();
  });
});

describe('checkTimeEventOverlap', () => {
  const approvedSick = {
    id: 'a1',
    type: 'sick_leave',
    status: 'approved',
    startDate: '2026-08-01',
    endDate: '2026-08-05',
  };

  it('forbids work vs approved full absence', () => {
    const err = checkTimeEventOverlap({
      candidate: {
        type: 'extra_work_day',
        startDate: '2026-08-01',
        endDate: null,
        startTime: null,
        endTime: null,
      },
      existing: [approvedSick],
    });
    expect(err?.code).toBe('TIME_EVENT_OVERLAP');
    expect(err?.conflictingStatuses).toContain('approved');
  });

  it('self-excludes current request on update', () => {
    const err = checkTimeEventOverlap({
      candidate: {
        type: 'vacation',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        startTime: null,
        endTime: null,
      },
      existing: [
        {
          id: 'self',
          type: 'vacation',
          status: 'pending',
          startDate: '2026-08-01',
          endDate: '2026-08-05',
        },
      ],
      excludeRequestId: 'self',
    });
    expect(err).toBeNull();
  });

  it('pending vacation blocks work with pending status', () => {
    const err = checkTimeEventOverlap({
      candidate: {
        type: 'overtime',
        startDate: '2026-08-02',
        endDate: null,
        startTime: '18:00',
        endTime: '21:00',
      },
      existing: [
        {
          id: 'p1',
          type: 'vacation',
          status: 'pending',
          startDate: '2026-08-01',
          endDate: '2026-08-10',
        },
      ],
    });
    expect(err?.conflictingStatuses).toEqual(['pending']);
  });

  it('allows overtime alongside business_trip', () => {
    const err = checkTimeEventOverlap({
      candidate: {
        type: 'overtime',
        startDate: '2026-08-02',
        endDate: null,
        startTime: '18:00',
        endTime: '21:00',
      },
      existing: [
        {
          id: 't1',
          type: 'business_trip',
          status: 'approved',
          startDate: '2026-08-01',
          endDate: '2026-08-05',
        },
      ],
    });
    expect(err).toBeNull();
  });

  it('forbids overlapping overtime intervals', () => {
    const err = checkTimeEventOverlap({
      candidate: {
        type: 'overtime',
        startDate: '2026-08-02',
        endDate: null,
        startTime: '19:00',
        endTime: '22:00',
      },
      existing: [
        {
          id: 'o1',
          type: 'overtime',
          status: 'approved',
          startDate: '2026-08-02',
          endDate: null,
          startTime: '18:00',
          endTime: '21:00',
        },
      ],
    });
    expect(err?.code).toBe('TIME_EVENT_OVERLAP');
  });
});
