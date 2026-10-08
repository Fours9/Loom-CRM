export type UserRole = 'employee' | 'department_manager' | 'admin';
export type UserStatus = 'active' | 'deactivated';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  isHidden: boolean;
  isActive: boolean;
  directionId?: string | null;
  directionName?: string | null;
}

export interface Position {
  id: string;
  name: string;
  departmentId: string | null;
  directionId?: string | null;
  directionName?: string | null;
  description: string | null;
  isActive: boolean;
  department?: Department | null;
}

export interface ScheduleDay {
  weekday: number;
  isWorkingDay: boolean;
  startTime: string | null;
  endTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  note: string | null;
}

export interface EmployeeListItem {
  id: string;
  userId: string | null;
  hasAccount: boolean;
  employeeNumber: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  fullName: string;
  photoUrl?: string | null;
  departmentId: string;
  departmentName: string | null;
  positionId: string;
  positionName: string | null;
  directionId?: string | null;
  directionName?: string | null;
  calendarColor: string;
  role: UserRole;
  isDepartmentManager?: boolean;
  /** AccountRole projection when hasAccount (Organization list/detail). */
  accountRole?: {
    id: string;
    code: string | null;
    name: string;
    isAdminEquivalent: boolean;
  } | null;
  /** @deprecated use accountStatus / hasAccount */
  status?: UserStatus | null;
  accountStatus?: UserStatus;
  accountEmail?: string;
  /** @deprecated use accountEmail / workEmail */
  email?: string | null;
  workEmail?: string | null;
  phoneNumber: string | null;
  telegram: string | null;
  /** Present on Organization list responses after Phase 1 polish. */
  completenessPercent?: number;
  createdAt: string;
}

export interface EmployeeProfile extends EmployeeListItem {
  schedule: ScheduleDay[];
  requestsPlaceholder: unknown[];
  mustChangePassword: boolean | null;
  managedDepartmentIds?: string[];
  managedDepartments?: Array<{ id: string; name: string | null }>;
  profileVisibilityOverride?: 'all' | 'own_department' | 'deny' | null;
  absenceVisibilityOverride?: 'all' | 'own_department' | 'deny' | null;
  showAbsenceTypeToPeersOverride?: boolean | null;
  /** Omitted when viewer has no access */
  comment?: string | null;
  adminComment?: string | null;
  personalPhoneNumber?: string | null;
  personalTelegram?: string | null;
  personalEmail?: string | null;
  permissions?: {
    canEditProfile: boolean;
    canEditOrgAssignment?: boolean;
    canEditSchedule: boolean;
    canResetPassword: boolean;
    canCreateAccount?: boolean;
    canManageAccount?: boolean;
    canViewAccountDetails?: boolean;
    canViewComment?: boolean;
    canEditComment?: boolean;
    canViewAdminComment?: boolean;
    canEditAdminComment?: boolean;
    canViewPersonalContacts?: boolean;
    canEditPersonalContacts?: boolean;
    canExportProfilePdf?: boolean;
    canViewProfileVisibilityOverride?: boolean;
    canEditProfileVisibilityOverride?: boolean;
    canViewAbsenceVisibilityOverride?: boolean;
    canEditAbsenceVisibilityOverride?: boolean;
    canViewShowAbsenceTypeToPeersOverride?: boolean;
    canEditShowAbsenceTypeToPeersOverride?: boolean;
  };
}

export type ProfileVisibilityMode = 'none' | 'own_department' | 'all';

export interface PrivacySettings {
  id: number;
  absenceVisibilityMode:
    | 'none'
    | 'own_department'
    | 'all_approved';
  profileVisibilityMode: ProfileVisibilityMode;
  globalPrivacyPriority: boolean;
  showDepartmentOnCalendar: boolean;
  showPositionOnCalendar: boolean;
  /** Peer viewers: show absence type/reason (чужі). Own/admin/managed always full. */
  showAbsenceTypeToPeers: boolean;
  sessionInactivityMinutes: number;
}

export interface CreateEmployeePayload {
  createAccount: boolean;
  email?: string;
  temporaryPassword?: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  phoneNumber?: string;
  telegram?: string;
  workEmail?: string | null;
  personalPhoneNumber?: string;
  personalTelegram?: string;
  personalEmail?: string;
  comment?: string;
  adminComment?: string;
  calendarColor: string;
  profileVisibilityOverride?: 'all' | 'own_department' | 'deny' | null;
  absenceVisibilityOverride?: 'all' | 'own_department' | 'deny' | null;
  showAbsenceTypeToPeersOverride?: boolean | null;
  schedule?: ScheduleDay[];
  /** Optional — omit or null when unset. */
  departmentId?: string | null;
  positionId?: string | null;
}

export type AbsenceType =
  | 'day_off'
  | 'vacation'
  | 'sick_leave'
  | 'part_time'
  | 'overtime'
  | 'business_trip'
  | 'extra_work_day';

export type TimeEventType = AbsenceType;
export type TimeEventCategory = 'absence' | 'work';
export type TimeEventDateMode = 'single_day' | 'date_range';
export type TimeEventTimeMode = 'none' | 'optional' | 'required';
export type TimeEventVisualKind =
  | 'absence'
  | 'partial_absence'
  | 'overtime'
  | 'business_trip'
  | 'extra_work_day';

export type TimeEventTypeMetadata = {
  value: TimeEventType;
  label: string;
  category: TimeEventCategory;
  dateMode: TimeEventDateMode;
  timeMode: TimeEventTimeMode;
  supportsUnpaid: boolean;
  visualKind: TimeEventVisualKind;
  schedulePolicy?: 'any' | 'scheduled_work_day' | 'scheduled_day_off';
};

export type AbsenceMetadataResponse = {
  types: TimeEventTypeMetadata[];
  statuses: Array<{ value: string; label: string }>;
  departments: Array<{ id: string; name: string }>;
  requestScopes: Array<{ value: string; label: string }>;
  scheduleConstraints: {
    minimumDate: string | null;
    maximumDate: string | null;
    supportsPartialDay: boolean;
  };
  /** Server-computed actor capabilities — SoT for create-for-other UI. */
  capabilities?: {
    canCreateForOther: boolean;
  };
};

export type AbsenceRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'deletion_requested';

export type AbsenceRequestStatusGroup = AbsenceRequestStatus | 'completed';

export interface AbsenceRequestListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  calendarColor: string | null;
  /** Null when peer viewer must not see type (hide-type privacy). */
  type: AbsenceType | null;
  status: AbsenceRequestStatus;
  statusGroup: AbsenceRequestStatusGroup;
  startDate: string;
  endDate: string | null;
  absenceStartTime: string | null;
  absenceEndTime: string | null;
  /** Computed for timed types (e.g. overtime); not persisted. */
  durationMinutes?: number | null;
  isUnpaid: boolean | null;
  reason: string | null;
  version: number;
  createdAt: string;
  decidedAt: string | null;
  deletionRequestedAt: string | null;
  departmentIdAtSubmission: string;
  departmentName: string | null;
  positionIdAtSubmission: string | null;
  positionName: string | null;
  canDelete: boolean;
  canEdit: boolean;
}

export interface AbsenceRequestPermissions {
  canApprove: boolean;
  canReject: boolean;
  canAdjust: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRequestDeletion: boolean;
  canApproveDeletion: boolean;
  canRejectDeletion: boolean;
  canManageAttachments: boolean;
}

export interface AbsenceRequestAttachment {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AbsenceRequestHistoryItem {
  id: string;
  fromStatus: AbsenceRequestStatus | null;
  toStatus: AbsenceRequestStatus | null;
  changeDescription: string;
  changedByUserId: string;
  createdAt: string;
}

export interface AbsenceRequestDetail extends AbsenceRequestListItem {
  employeeNameAtSubmission: string;
  employeeNumber: string | null;
  calendarColor: string | null;
  departmentName: string | null;
  positionIdAtSubmission: string | null;
  positionName: string | null;
  employeeComment: string | null;
  decisionComment: string | null;
  adjustmentComment: string | null;
  deletionComment: string | null;
  createdByUserId: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  statusBeforeDeletionRequest: AbsenceRequestStatus | null;
  deletionRequestedAt: string | null;
  permissions: AbsenceRequestPermissions;
  history: AbsenceRequestHistoryItem[];
  attachments: AbsenceRequestAttachment[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateAbsenceRequestPayload {
  employeeId?: string;
  type: AbsenceType;
  startDate: string;
  endDate?: string | null;
  absenceStartTime?: string | null;
  absenceEndTime?: string | null;
  reason?: string | null;
  isUnpaid?: boolean;
  employeeComment?: string | null;
}

export type { AppNotification } from '../../../../core/notifications/notification.models';

export type CalendarStatusGroup = 'approved' | 'pending';

export type CalendarPattern =
  | 'solid'
  | 'hatch_left'
  | 'hatch_mid'
  | 'hatch_right'
  | 'busy_anonymous';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

export interface CalendarSegmentSummary {
  key: string;
  label: string;
  color: string;
  pattern: CalendarPattern;
  hatchStartRatio: number;
  hatchEndRatio: number;
  statusGroup: CalendarStatusGroup;
  startTime?: string;
  endTime?: string;
  requestId?: string;
  ariaLabel: string;
  visualKind?: TimeEventVisualKind;
  category?: TimeEventCategory;
  deletionRequested?: true;
  /** Approved absence whose inclusive period already ended (server Kyiv today). */
  periodEnded?: true;
}

export type CalendarLegendItem = {
  value: TimeEventType;
  label: string;
  category: TimeEventCategory;
  visualKind: TimeEventVisualKind;
  pattern: CalendarPattern;
};

export interface CalendarDaySummary {
  date: string;
  segments: CalendarSegmentSummary[];
  overflowCount: number;
}

export interface CalendarDayItem extends CalendarSegmentSummary {
  employeeName?: string;
  departmentName?: string;
  positionName?: string;
  absenceTypeLabel?: string;
  eventTypeLabel?: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface CalendarRangeResponse {
  days: CalendarDaySummary[];
  legend?: CalendarLegendItem[];
}

export interface CalendarDayResponse {
  date: string;
  items: CalendarDayItem[];
  legend?: CalendarLegendItem[];
}

export interface CalendarQueryFilters {
  employeeIds?: string[];
  departmentIds?: string[];
  positionIds?: string[];
  types?: AbsenceType[];
  statusGroups?: CalendarStatusGroup[];
}
