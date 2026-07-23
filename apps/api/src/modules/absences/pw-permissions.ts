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

export function pwPermissions(
  actor: User,
  request: AbsenceRequest,
  employee: Employee,
  permissions: PermissionService,
): PwPermissions {
  const isOwner = employee.userId === actor.id;
  const isCreator = request.createdByUserId === actor.id;
  const isAdmin = actor.role === UserRole.Admin;
  const pending = request.status === AbsenceRequestStatus.Pending;
  const approved = request.status === AbsenceRequestStatus.Approved;
  const deletionRequested =
    request.status === AbsenceRequestStatus.DeletionRequested;
  const canModerate =
    permissions.has(actor.role, Permission.AbsencesApprove) && !isOwner;

  return {
    canApprove: pending && canModerate,
    canReject: pending && canModerate,
    canAdjust: approved && canModerate,
    canEdit: pending && (isOwner || isAdmin || isCreator),
    canDelete:
      pending &&
      (isOwner || isAdmin || isCreator) &&
      permissions.has(actor.role, Permission.AbsencesCancel),
    canRequestDeletion: approved && (isOwner || isAdmin),
    canApproveDeletion: deletionRequested && isAdmin,
    canRejectDeletion: deletionRequested && isAdmin,
    canManageAttachments:
      (pending && (isOwner || isAdmin || isCreator)) ||
      (approved && canModerate),
  };
}
