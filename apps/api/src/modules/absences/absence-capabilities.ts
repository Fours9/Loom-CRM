import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { PermissionService } from '../../platform/permissions/permission.service';
import { Permission } from '../../platform/permissions/permission.names';
import { Employee } from '../../organization/employees/employee.entity';
import { AbsenceRequest } from './absence-request.entity';
import { AbsenceRequestStatus } from './absence.enums';

export type ListCapabilities = {
  canOpen: boolean;
  canApprove: boolean;
  canReject: boolean;
};

export type DetailCapabilities = {
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
  canAdjust: boolean;
  canRequestDeletion: boolean;
  canManageAttachments: boolean;
};

export function listCapabilities(
  actor: User,
  request: AbsenceRequest,
  employee: Employee,
  permissions: PermissionService,
): ListCapabilities {
  const canModerate =
    permissions.has(actor.role, Permission.AbsencesApprove) &&
    request.status === AbsenceRequestStatus.Pending &&
    employee.userId !== actor.id;
  return {
    canOpen: true,
    canApprove: canModerate,
    canReject: canModerate,
  };
}

export function detailCapabilities(
  actor: User,
  request: AbsenceRequest,
  employee: Employee,
  permissions: PermissionService,
): DetailCapabilities {
  const isOwner = employee.userId === actor.id;
  const isAdmin = actor.role === UserRole.Admin;
  const pending = request.status === AbsenceRequestStatus.Pending;
  const approved = request.status === AbsenceRequestStatus.Approved;
  const cancelled = request.status === AbsenceRequestStatus.Cancelled;
  const canModerate =
    permissions.has(actor.role, Permission.AbsencesApprove) &&
    (employee.userId === actor.id
      ? actor.role === UserRole.Admin
      : actor.role === UserRole.Admin ||
        actor.role === UserRole.DepartmentManager);

  return {
    canEdit: pending && (isOwner || isAdmin),
    canApprove: pending && canModerate,
    canReject: pending && canModerate,
    canCancel:
      pending &&
      (isOwner || isAdmin) &&
      permissions.has(actor.role, Permission.AbsencesCancel),
    canAdjust: approved && canModerate,
    canRequestDeletion: (approved || cancelled) && (isOwner || isAdmin),
    canManageAttachments:
      (pending && (isOwner || isAdmin)) ||
      (approved && canModerate),
  };
}
