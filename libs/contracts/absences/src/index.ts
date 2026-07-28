import type { EntityId } from '@loom/contracts-common';

export type AbsenceRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'deletion_requested';

/** Compatibility alias — product domain: TimeEventType. */
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

/** Response shape only — invariants live in API TypeCatalog. */
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

export type EmployeeReference = {
  id: EntityId;
  name: string;
};

export type DateRangeResponse = {
  startDate: string;
  endDate: string;
};

export type AbsenceListCapabilities = {
  canOpen: boolean;
  canApprove: boolean;
  canReject: boolean;
};

export type AbsenceDetailCapabilities = {
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
  canAdjust: boolean;
  canRequestDeletion: boolean;
  canManageAttachments: boolean;
};

export type AbsenceRequestListItem = {
  id: EntityId;
  status: AbsenceRequestStatus;
  type: AbsenceType;
  employee: EmployeeReference;
  period: DateRangeResponse;
  capabilities: AbsenceListCapabilities;
  /** Computed for timed types (overtime); not persisted. */
  durationMinutes?: number | null;
};

export type AbsenceRequestView = {
  id: EntityId;
  status: AbsenceRequestStatus;
  type: AbsenceType;
  employeeId: EntityId;
  employee: EmployeeReference;
  period: DateRangeResponse;
  reason: string | null;
  decisionComment: string | null;
  createdByUserId: EntityId;
  createdAt: string;
  durationMinutes?: number | null;
};

export type AbsenceRequestDetailResponse = {
  request: AbsenceRequestView;
  capabilities: AbsenceDetailCapabilities;
  history: Array<{
    id: EntityId;
    action: string;
    actorUserId: EntityId | null;
    comment: string | null;
    createdAt: string;
  }>;
};

export type AbsenceMetadataResponse = {
  types: TimeEventTypeMetadata[];
  statuses: Array<{ value: AbsenceRequestStatus; label: string }>;
  departments: Array<{ id: EntityId; name: string }>;
  requestScopes: Array<{ value: string; label: string }>;
  scheduleConstraints: {
    minimumDate: string | null;
    maximumDate: string | null;
    supportsPartialDay: boolean;
  };
};

export type CreateAbsenceRequest = {
  employeeId: EntityId;
  type: AbsenceType;
  startDate: string;
  endDate?: string | null;
  reason?: string | null;
  absenceStartTime?: string | null;
  absenceEndTime?: string | null;
  isUnpaid?: boolean;
};

export type AbsenceDocumentFileItem = {
  id: EntityId;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
};

/**
 * Time-event request with ≥1 attachment, for People Documents aggregation.
 * Atomic remap (ADR 0008): neutral source/eventType — no dual source in one field.
 */
export type AbsenceDocumentListItem = {
  source: 'time_event';
  id: EntityId;
  employeeId: EntityId;
  documentType: 'time_event';
  /** Neutral fallback; UA title is built on the frontend from eventType + dates. */
  title: string;
  eventType: TimeEventType;
  /** @deprecated Use eventType — kept briefly for type migration clarity; omit in payloads. */
  absenceType?: never;
  createdAt: string;
  relatedStartDate: string;
  relatedEndDate: string | null;
  files: AbsenceDocumentFileItem[];
  permissions: {
    canDelete: false;
  };
};
