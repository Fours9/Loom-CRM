import {
  hasPermission,
  type AuthorizationContext,
} from '../../platform/access-control/authorization-context';
import { Permission } from '../../platform/permissions/permission.names';
import { Employee } from '../../organization/employees/employee.entity';
import { AbsenceRequest } from './absence-request.entity';
import { AbsenceRequestStatus } from './absence.enums';

export type PwPermissions = {
  canApprove: boolean;
  canReject: boolean;
  canAdjust: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRequestDeletion: boolean;
  canApproveDeletion: boolean;
  canRejectDeletion: boolean;
  canManageAttachments: boolean;
};

export type PwPermissionContext = {
  /** Organization already resolved: actor manages the request's effective submission dept. */
  inManagedSubmissionDepartment: boolean;
};

function todayKyiv(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function statusGroupOf(row: AbsenceRequest): string {
  if (row.status === AbsenceRequestStatus.Approved) {
    const end = row.endDate ?? row.startDate;
    if (end < todayKyiv()) return 'completed';
  }
  return row.status;
}

/**
 * PW-parity capabilities for a request detail/list row.
 * AuthZ SoT = AuthorizationContext (never users.role / PermissionService.has(role)).
 *
 * @see Absences AuthZ plan — locked truth table (adminEq vs AbsencesAdmin).
 */
export function pwPermissions(
  authz: AuthorizationContext,
  request: AbsenceRequest,
  employee: Employee,
  ctx: PwPermissionContext,
): PwPermissions {
  const isOwner = employee.userId === authz.userId;
  const isCreator = request.createdByUserId === authz.userId;
  const adminEq = authz.isAdminEquivalent;
  const hasApprove = hasPermission(authz, Permission.AbsencesApprove);
  const hasAdmin = hasPermission(authz, Permission.AbsencesAdmin);
  const hasCancel = hasPermission(authz, Permission.AbsencesCancel);

  const pending = request.status === AbsenceRequestStatus.Pending;
  const approved = request.status === AbsenceRequestStatus.Approved;
  const rejected = request.status === AbsenceRequestStatus.Rejected;
  const cancelled = request.status === AbsenceRequestStatus.Cancelled;
  const deletionRequested =
    request.status === AbsenceRequestStatus.DeletionRequested;
  const terminal = approved || rejected || cancelled;

  const canModerate =
    hasApprove &&
    (isOwner ? adminEq : adminEq || ctx.inManagedSubmissionDepartment);

  return {
    canApprove: pending && canModerate,
    canReject: pending && canModerate,
    canAdjust: approved && canModerate,
    canEdit: pending && (isOwner || isCreator || adminEq),
    canDelete:
      pending && hasCancel && (isOwner || isCreator || adminEq),
    canRequestDeletion:
      terminal &&
      (isOwner || adminEq || ctx.inManagedSubmissionDepartment),
    canApproveDeletion: deletionRequested && hasAdmin,
    canRejectDeletion: deletionRequested && hasAdmin,
    canManageAttachments:
      (pending && (isOwner || isCreator || adminEq)) ||
      (approved && canModerate),
  };
}
