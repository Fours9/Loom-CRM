import {
  isFullAbsenceType,
  parseHhMm,
  type TimeEventType,
} from './time-event-type-catalog';

export type OverlapBlockingStatus =
  | 'pending'
  | 'approved'
  | 'deletion_requested';

export type ExistingTimeEventForOverlap = {
  id: string;
  type: TimeEventType | string;
  status: string;
  statusBeforeDeletionRequest?: string | null;
  startDate: string;
  endDate: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

export type OverlapCandidate = {
  type: TimeEventType;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
};

export type TimeEventOverlapError = {
  code: 'TIME_EVENT_OVERLAP';
  message: string;
  conflictingRequestIds: string[];
  conflictingStatuses: string[];
};

const NON_BLOCKING = new Set(['rejected', 'cancelled']);

/**
 * Whether a stored request blocks new overlapping events.
 * deletion_requested uses statusBeforeDeletionRequest (ADR 0008).
 */
export function isBlockingOverlapStatus(
  status: string,
  statusBeforeDeletionRequest?: string | null,
): boolean {
  if (NON_BLOCKING.has(status)) return false;
  if (status === 'pending' || status === 'approved') return true;
  if (status === 'deletion_requested') {
    const prior = statusBeforeDeletionRequest ?? 'approved';
    return prior === 'pending' || prior === 'approved';
  }
  return false;
}

export function checkTimeEventOverlap(args: {
  candidate: OverlapCandidate;
  existing: ExistingTimeEventForOverlap[];
  excludeRequestId?: string | null;
}): TimeEventOverlapError | null {
  const conflicts: ExistingTimeEventForOverlap[] = [];

  for (const row of args.existing) {
    if (args.excludeRequestId && row.id === args.excludeRequestId) continue;
    if (!isBlockingOverlapStatus(row.status, row.statusBeforeDeletionRequest)) {
      continue;
    }
    if (!datesOverlap(args.candidate, row)) continue;
    if (!typesConflict(args.candidate, row)) continue;
    conflicts.push(row);
  }

  if (conflicts.length === 0) return null;

  const statuses = [
    ...new Set(
      conflicts.map((c) =>
        c.status === 'deletion_requested'
          ? (c.statusBeforeDeletionRequest ?? 'approved')
          : c.status,
      ),
    ),
  ];

  return {
    code: 'TIME_EVENT_OVERLAP',
    message: 'Заявка перетинається з іншою активною заявкою',
    conflictingRequestIds: conflicts.map((c) => c.id),
    conflictingStatuses: statuses,
  };
}

function datesOverlap(
  a: { startDate: string; endDate: string | null },
  b: { startDate: string; endDate: string | null },
): boolean {
  const aEnd = a.endDate ?? a.startDate;
  const bEnd = b.endDate ?? b.startDate;
  return a.startDate <= bEnd && b.startDate <= aEnd;
}

function typesConflict(
  candidate: OverlapCandidate,
  existing: ExistingTimeEventForOverlap,
): boolean {
  const a = candidate.type;
  const b = existing.type as TimeEventType;

  // Full absences block everything on date overlap (incl. other full absences).
  if (isFullAbsenceType(a) || isFullAbsenceType(b)) {
    return true;
  }

  // part_time × extra_work_day
  if (
    (a === 'part_time' && b === 'extra_work_day') ||
    (b === 'part_time' && a === 'extra_work_day')
  ) {
    return true;
  }

  // part_time × part_time / overtime: time overlap
  if (
    (a === 'part_time' || a === 'overtime') &&
    (b === 'part_time' || b === 'overtime')
  ) {
    return timesOverlap(
      candidate.startTime,
      candidate.endTime,
      existing.startTime,
      existing.endTime,
    );
  }

  // overtime × overtime already covered above
  // overtime vs business_trip / extra_work_day: allow
  if (a === 'overtime' || b === 'overtime') {
    if (
      (a === 'business_trip' || b === 'business_trip') ||
      (a === 'extra_work_day' || b === 'extra_work_day')
    ) {
      return false;
    }
  }

  // business_trip × extra_work_day: allow
  if (
    (a === 'business_trip' && b === 'extra_work_day') ||
    (b === 'business_trip' && a === 'extra_work_day')
  ) {
    return false;
  }

  // Same work type on overlapping dates (trip×trip, extra×extra)
  if (a === b) return true;

  // part_time × business_trip
  if (
    (a === 'part_time' && b === 'business_trip') ||
    (b === 'part_time' && a === 'business_trip')
  ) {
    return true;
  }

  return true;
}

function timesOverlap(
  aStart: string | null | undefined,
  aEnd: string | null | undefined,
  bStart: string | null | undefined,
  bEnd: string | null | undefined,
): boolean {
  // Missing times → treat as full-day conflict on that date
  if (!aStart || !aEnd || !bStart || !bEnd) return true;
  const as = parseHhMm(aStart);
  const ae = parseHhMm(aEnd);
  const bs = parseHhMm(bStart);
  const be = parseHhMm(bEnd);
  if (as == null || ae == null || bs == null || be == null) return true;
  return as < be && bs < ae;
}
