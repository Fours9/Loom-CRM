import { BadRequestException } from '@nestjs/common';
import {
  getTimeEventTypeDefinition,
  isTimeEventType,
  parseHhMm,
  type TimeEventType,
} from './time-event-type-catalog';

export type TimeEventCandidateInput = {
  type: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isUnpaid?: boolean | null;
};

export type NormalizedTimeEventCandidate = {
  type: TimeEventType;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  isUnpaid: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates / normalizes fields according to TypeCatalog.
 * Does not check schedule or overlap — those are separate policies.
 */
export function validateTimeEventCandidate(
  input: TimeEventCandidateInput,
): NormalizedTimeEventCandidate {
  if (!isTimeEventType(input.type)) {
    throw new BadRequestException({
      code: 'TIME_EVENT_INVALID_TYPE',
      message: `Unknown time event type: ${input.type}`,
    });
  }
  const def = getTimeEventTypeDefinition(input.type)!;

  if (!DATE_RE.test(input.startDate)) {
    throw new BadRequestException({
      code: 'TIME_EVENT_INVALID_DATE',
      message: 'startDate must be YYYY-MM-DD',
    });
  }

  let endDate: string | null = input.endDate ?? null;
  if (def.dateMode === 'single_day') {
    endDate = null;
  } else {
    if (endDate != null && endDate !== '' && !DATE_RE.test(endDate)) {
      throw new BadRequestException({
        code: 'TIME_EVENT_INVALID_DATE',
        message: 'endDate must be YYYY-MM-DD',
      });
    }
    if (!endDate) {
      endDate = input.startDate;
    }
    if (endDate < input.startDate) {
      throw new BadRequestException({
        code: 'TIME_EVENT_INVALID_DATE_RANGE',
        message: 'endDate must be on or after startDate',
      });
    }
  }

  let startTime: string | null = normalizeTime(input.startTime);
  let endTime: string | null = normalizeTime(input.endTime);

  if (def.timeMode === 'none') {
    startTime = null;
    endTime = null;
  } else if (def.timeMode === 'required') {
    if (!startTime || !endTime) {
      throw new BadRequestException({
        code: 'TIME_EVENT_TIME_REQUIRED',
        message: 'startTime and endTime are required for this type',
      });
    }
    assertTimeOrder(startTime, endTime);
  } else {
    // optional
    if ((startTime && !endTime) || (!startTime && endTime)) {
      throw new BadRequestException({
        code: 'TIME_EVENT_TIME_INCOMPLETE',
        message: 'Provide both startTime and endTime, or neither',
      });
    }
    if (startTime && endTime) {
      assertTimeOrder(startTime, endTime);
    }
  }

  let isUnpaid = !!input.isUnpaid;
  if (!def.supportsUnpaid) {
    if (input.isUnpaid) {
      throw new BadRequestException({
        code: 'TIME_EVENT_UNPAID_UNSUPPORTED',
        message: 'isUnpaid is not supported for this type',
      });
    }
    isUnpaid = false;
  }

  return {
    type: input.type,
    startDate: input.startDate,
    endDate,
    startTime,
    endTime,
    isUnpaid,
  };
}

function normalizeTime(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const trimmed = value.trim();
  if (parseHhMm(trimmed) == null) {
    throw new BadRequestException({
      code: 'TIME_EVENT_INVALID_TIME',
      message: 'Time must be HH:mm',
    });
  }
  return trimmed;
}

function assertTimeOrder(startTime: string, endTime: string) {
  const start = parseHhMm(startTime)!;
  const end = parseHhMm(endTime)!;
  if (end <= start) {
    throw new BadRequestException({
      code: 'TIME_EVENT_INVALID_TIME_RANGE',
      message: 'endTime must be after startTime (same-day; no midnight wrap)',
    });
  }
}
