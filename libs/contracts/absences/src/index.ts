import type { EntityId } from '@loom/contracts-common';

export type AbsenceRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'deletion_requested';

export type AbsenceType =
  | 'day_off'
  | 'vacation'
  | 'sick_leave'
  | 'part_time';

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
  types: Array<{ value: AbsenceType; label: string }>;
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
};

export type AbsenceDocumentFileItem = {
  id: EntityId;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
};

/** Absence request with ≥1 attachment, for People Documents aggregation. */
export type AbsenceDocumentListItem = {
  source: 'absence';
  id: EntityId;
  employeeId: EntityId;
  documentType: 'absence';
  /** Neutral fallback; UA title is built on the frontend from absenceType + dates. */
  title: string;
  absenceType: AbsenceType;
  createdAt: string;
  relatedStartDate: string;
  relatedEndDate: string | null;
  files: AbsenceDocumentFileItem[];
  permissions: {
    canDelete: false;
  };
};
