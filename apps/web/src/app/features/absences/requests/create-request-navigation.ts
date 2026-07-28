/**
 * Single FE navigation contract for opening the create-absence-request screen.
 * Production CTAs must use buildCreateAbsenceRequestLink — do not hardcode path/query.
 * Route definition (absences.routes.ts), docs, and tests may use route literals.
 */

export const CREATE_ABSENCE_REQUEST_NAVIGATION = {
  path: '/absences/requests/new',
  query: {
    startDate: 'startDate',
    employeeId: 'employeeId',
  },
} as const;

export type CreateAbsenceRequestPrefill = {
  startDate?: string;
  employeeId?: string;
};

export type CreateAbsenceRequestLink = {
  routerLink: string;
  queryParams: Record<string, string>;
};

/** Calendar-valid YYYY-MM-DD (rejects 2026-02-31, 2026-13-05, etc.). */
export function isIsoDateYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function buildCreateAbsenceRequestLink(
  prefill: CreateAbsenceRequestPrefill = {},
): CreateAbsenceRequestLink {
  const queryParams: Record<string, string> = {};

  const startDate = prefill.startDate?.trim();
  if (startDate && isIsoDateYmd(startDate)) {
    queryParams[CREATE_ABSENCE_REQUEST_NAVIGATION.query.startDate] = startDate;
  }

  const employeeId = prefill.employeeId?.trim();
  if (employeeId) {
    queryParams[CREATE_ABSENCE_REQUEST_NAVIGATION.query.employeeId] = employeeId;
  }

  return {
    routerLink: CREATE_ABSENCE_REQUEST_NAVIGATION.path,
    queryParams,
  };
}

export function parseCreateAbsenceRequestPrefill(
  params: Pick<{ get(name: string): string | null }, 'get'>,
): CreateAbsenceRequestPrefill {
  const result: CreateAbsenceRequestPrefill = {};

  const startDate = params
    .get(CREATE_ABSENCE_REQUEST_NAVIGATION.query.startDate)
    ?.trim();

  if (startDate && isIsoDateYmd(startDate)) {
    result.startDate = startDate;
  }

  const employeeId = params
    .get(CREATE_ABSENCE_REQUEST_NAVIGATION.query.employeeId)
    ?.trim();

  if (employeeId) {
    result.employeeId = employeeId;
  }

  return result;
}
