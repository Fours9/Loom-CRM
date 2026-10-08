import type {
  CreateEmployeeRequest,
  EmployeeCreateScheduleDay,
  EmploymentManagementKind,
} from '@loom/contracts-employees';
import { nextRandomEmployeeCalendarColor } from './employee-calendar-color';
import {
  defaultSchedule,
  normalizeSchedulePayload,
} from '../schedule/schedule.util';
import type { ScheduleDay } from '../schedule/schedule.model';

export type EmployeeCreateDraft = {
  createAccount: boolean;
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  workEmail: string;
  phoneNumber: string;
  telegram: string;
  personalEmail: string;
  personalPhoneNumber: string;
  personalTelegram: string;
  temporaryPassword: string;
  directionId: string;
  departmentId: string;
  positionId: string;
  /** Empty string = auto by position membership. */
  accountRoleId: string;
  /**
   * Local preview only (from Position.managementKindTemplate).
   * Not sent on CreateEmployeeRequest — backend SoT is locked Position.
   */
  managementKind: EmploymentManagementKind;
  calendarColor: string;
  schedule: ScheduleDay[];
};

export function emptyEmployeeCreateDraft(
  _caps?: {
    canCreateAccountAtCreate?: boolean;
  },
  options?: {
    /** Inject for tests; default = crypto palette pick. */
    calendarColor?: string;
    randomByte?: () => number;
  },
): EmployeeCreateDraft {
  return {
    createAccount: false,
    lastName: '',
    firstName: '',
    middleName: '',
    email: '',
    workEmail: '',
    phoneNumber: '',
    telegram: '',
    personalEmail: '',
    personalPhoneNumber: '',
    personalTelegram: '',
    temporaryPassword: '',
    directionId: '',
    departmentId: '',
    positionId: '',
    accountRoleId: '',
    managementKind: 'none',
    calendarColor:
      options?.calendarColor ??
      nextRandomEmployeeCalendarColor(options?.randomByte),
    schedule: defaultSchedule(),
  };
}

export function generateTemporaryPassword(length = 14): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export function optionalOrgAssignmentIds(input: {
  directionId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
}): {
  directionId: string | null;
  departmentId: string | null;
  positionId: string | null;
} {
  return {
    directionId: emptyToNull(input.directionId),
    departmentId: emptyToNull(input.departmentId),
    positionId: emptyToNull(input.positionId),
  };
}

function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type EmployeeCreateValidationError =
  | 'required_names'
  | 'account_email_required'
  | 'account_password_required'
  | 'account_password_short';

export function validateEmployeeCreateDraft(
  draft: EmployeeCreateDraft,
): EmployeeCreateValidationError | null {
  if (!draft.firstName.trim() || !draft.lastName.trim()) {
    return 'required_names';
  }
  if (draft.createAccount) {
    if (!draft.email.trim()) return 'account_email_required';
    if (!draft.temporaryPassword) return 'account_password_required';
    if (draft.temporaryPassword.length < 8) return 'account_password_short';
  }
  return null;
}

export function normalizeEmployeeCreateDraft(
  draft: EmployeeCreateDraft,
): CreateEmployeeRequest {
  const org = optionalOrgAssignmentIds({
    directionId: draft.directionId,
    departmentId: draft.departmentId,
    positionId: draft.positionId,
  });
  const payload: CreateEmployeeRequest = {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    middleName: draft.middleName.trim() || null,
    createAccount: draft.createAccount,
    workEmail: draft.workEmail.trim() || null,
    phoneNumber: draft.phoneNumber.trim() || null,
    telegram: draft.telegram.trim() || null,
    personalEmail: draft.personalEmail.trim() || null,
    personalPhoneNumber: draft.personalPhoneNumber.trim() || null,
    personalTelegram: draft.personalTelegram.trim() || null,
    calendarColor: draft.calendarColor.trim() || null,
    directionId: org.directionId,
    departmentId: org.departmentId,
    positionId: org.positionId,
    schedule: normalizeSchedulePayload(
      draft.schedule,
    ) as EmployeeCreateScheduleDay[],
  };
  if (draft.accountRoleId.trim()) {
    payload.accountRoleId = draft.accountRoleId.trim();
  }
  if (draft.createAccount) {
    payload.email = draft.email.trim();
    payload.temporaryPassword = draft.temporaryPassword;
  }
  return payload;
}
