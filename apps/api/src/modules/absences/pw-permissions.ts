import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { PermissionService } from '../../platform/permissions/permission.service';
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
  /** Viewer manages the request's submission department (or is admin). */
  canManageSubmissionDepartment: boolean;
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
 *
 * Moderation (approve/reject/adjust):
 * - Admin may moderate own requests (solo-admin).
 * - Managers may not moderate own requests.
 * - Non-owners: admin or manager of submission department.
 */
export function pwPermissions(
  actor: User,
  request: AbsenceRequest,
  employee: Employee,
  permissions: PermissionService,
  ctx: PwPermissionContext,
): PwPermissions {
  const isOwner = employee.userId === actor.id;
  const isCreator = request.createdByUserId === actor.id;
  const isAdmin = actor.role === UserRole.Admin;
  const pending = request.status === AbsenceRequestStatus.Pending;
  const approved = request.status === AbsenceRequestStatus.Approved;
  const cancelled = request.status === AbsenceRequestStatus.Cancelled;
  const deletionRequested =
    request.status === AbsenceRequestStatus.DeletionRequested;
  const hasApprove = permissions.has(actor.role, Permission.AbsencesApprove);

  const canModerateRequest =
    hasApprove &&
    (isOwner
      ? isAdmin
      : isAdmin || ctx.canManageSubmissionDepartment);

  return {
    canApprove: pending && canModerateRequest,
    canReject: pending && canModerateRequest,
    canAdjust: approved && canModerateRequest,
    canEdit: pending && (isOwner || isAdmin || isCreator),
    canDelete:
      pending &&
      (isOwner || isAdmin || isCreator) &&
      permissions.has(actor.role, Permission.AbsencesCancel),
    canRequestDeletion: (approved || cancelled) && (isOwner || isAdmin),
    canApproveDeletion: deletionRequested && isAdmin,
    canRejectDeletion: deletionRequested && isAdmin,
    canManageAttachments:
      (pending && (isOwner || isAdmin || isCreator)) ||
      (approved && canModerateRequest),
  };
}
