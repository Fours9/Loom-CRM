import { ForbiddenException } from '@nestjs/common';
import type { User } from '../../../platform/identity/user.entity';
import { Permission } from '../../../platform/permissions/permission.names';
import type { PermissionService } from '../../../platform/permissions/permission.service';
import type { EmployeeAccessService } from '../../../organization/access/employee-access.service';
import type { Employee } from '../../../organization/employees/employee.entity';
import type { QuestionnaireAssignment } from '../questionnaire-assignment.entity';
import type { QuestionnaireAssignmentStatus } from '../questionnaire.enums';
import {
  canAttachAssignment,
  canCancelAssignment,
  canCloseAssignment,
  canStartRevisionFromStatus,
  isOwnerEditableStatus,
} from './questionnaire-assignment-transitions';

export type AssignmentAccessContext = {
  assignment: QuestionnaireAssignment;
  employee: Employee | null;
};

export type QuestionnaireDetailCapabilities = {
  canEditDraft: boolean;
  canSubmit: boolean;
  canReopenSelf: boolean;
  canStartRevision: boolean;
  canRequestChanges: boolean;
  canReview: boolean;
  canDelete: boolean;
};

export type QuestionnaireListLifecycleCapabilities = {
  canOpen: boolean;
  canAssign: boolean;
  canAttach: boolean;
  canCancel: boolean;
  canClose: boolean;
  canDelete: boolean;
};

export function canCompleteOnBehalf(
  permissions: PermissionService,
  actor: User,
): boolean {
  return permissions.has(actor.role, Permission.QuestionnairesCompleteAny);
}

export function canManageLifecycle(
  permissions: PermissionService,
  actor: User,
): boolean {
  return permissions.has(actor.role, Permission.QuestionnairesAssign);
}

/**
 * Single source for detail draft/submit/revision/delete capabilities.
 * Lifecycle list capabilities are projected separately.
 */
export function computeDetailCapabilities(input: {
  actor: User;
  employee: Employee | null;
  status: QuestionnaireAssignmentStatus | string;
  permissions: PermissionService;
  access: EmployeeAccessService;
}): QuestionnaireDetailCapabilities {
  const { actor, employee, status, permissions, access } = input;
  const manage = canManageLifecycle(permissions, actor);
  const onBehalf = canCompleteOnBehalf(permissions, actor);
  const canReviewPerm = permissions.has(
    actor.role,
    Permission.QuestionnairesReview,
  );
  const canCompleteSelf = permissions.has(
    actor.role,
    Permission.QuestionnairesCompleteSelf,
  );

  if (status === 'new') {
    return {
      canEditDraft: manage && onBehalf,
      canSubmit: false,
      canReopenSelf: false,
      canStartRevision: false,
      canRequestChanges: false,
      canReview: false,
      canDelete: manage,
    };
  }

  if (status === 'closed') {
    return {
      canEditDraft: false,
      canSubmit: false,
      canReopenSelf: false,
      canStartRevision: false,
      canRequestChanges: false,
      canReview: false,
      canDelete: manage,
    };
  }

  if (status === 'cancelled') {
    return {
      canEditDraft: false,
      canSubmit: false,
      canReopenSelf: false,
      canStartRevision: false,
      canRequestChanges: false,
      canReview: false,
      canDelete: manage,
    };
  }

  if (!employee) {
    return {
      canEditDraft: false,
      canSubmit: false,
      canReopenSelf: false,
      canStartRevision: false,
      canRequestChanges: false,
      canReview: false,
      canDelete: manage,
    };
  }

  const isOwner = access.isOwner(actor, employee);

  const ownerEdit =
    isOwner && canCompleteSelf && isOwnerEditableStatus(status);

  const onBehalfEdit = onBehalf && isOwnerEditableStatus(status);

  const canEditDraft = ownerEdit || onBehalfEdit;
  const canSubmit = canEditDraft;

  const canReopenSelf =
    isOwner && canCompleteSelf && canStartRevisionFromStatus(status);

  const canStartRevision = onBehalf && canStartRevisionFromStatus(status);

  const canRequestChanges =
    canReviewPerm && canStartRevisionFromStatus(status);

  const canReview =
    canReviewPerm &&
    (status === 'submitted' ||
      status === 'changes_requested' ||
      status === 'reviewed');

  return {
    canEditDraft,
    canSubmit,
    canReopenSelf,
    canStartRevision,
    canRequestChanges,
    canReview,
    canDelete: manage,
  };
}

export function computeListLifecycleCapabilities(input: {
  actor: User;
  status: QuestionnaireAssignmentStatus | string;
  employeeId: string | null | undefined;
  detachedFromEmployeeId: string | null | undefined;
  permissions: PermissionService;
}): QuestionnaireListLifecycleCapabilities {
  const { actor, status, employeeId, detachedFromEmployeeId, permissions } =
    input;
  const manage = canManageLifecycle(permissions, actor);
  if (status === 'closed') {
    return {
      canOpen: true,
      canAssign: manage,
      canAttach: false,
      canCancel: false,
      canClose: false,
      canDelete: manage,
    };
  }
  return {
    canOpen: true,
    canAssign: manage,
    canAttach:
      manage &&
      canAttachAssignment({ status, employeeId, detachedFromEmployeeId }),
    canCancel: manage && canCancelAssignment(status),
    canClose: manage && canCloseAssignment(status),
    canDelete: manage,
  };
}

export function requireCanEditDraft(
  caps: QuestionnaireDetailCapabilities,
): void {
  if (!caps.canEditDraft) {
    throw new ForbiddenException('Assignment is not editable');
  }
}

export function requireCanSubmit(caps: QuestionnaireDetailCapabilities): void {
  if (!caps.canSubmit) {
    throw new ForbiddenException('Cannot submit questionnaire');
  }
}
