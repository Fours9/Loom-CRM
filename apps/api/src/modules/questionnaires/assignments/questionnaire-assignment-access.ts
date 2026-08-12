import { ForbiddenException } from '@nestjs/common';
import {
  EMPLOYEE_OWNER_VISIBLE_QUESTIONNAIRE_TYPES,
  type QuestionnaireType,
} from '@loom/contracts-questionnaires';
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
import {
  hasActiveReviewerRequest,
  type ActiveChangeRequestSubmission,
} from '../reopen/questionnaire-active-change-request';

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
  canResolveChangeRequest: boolean;
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

const EMPTY_CAPS: QuestionnaireDetailCapabilities = {
  canEditDraft: false,
  canSubmit: false,
  canReopenSelf: false,
  canStartRevision: false,
  canRequestChanges: false,
  canReview: false,
  canResolveChangeRequest: false,
  canDelete: false,
};

export function canAssignQuestionnaires(
  permissions: PermissionService,
  actor: User,
): boolean {
  return permissions.has(actor.role, Permission.QuestionnairesAssign);
}

export function canManageLifecycle(
  permissions: PermissionService,
  actor: User,
): boolean {
  return permissions.has(actor.role, Permission.QuestionnairesManageLifecycle);
}

export function canDeleteQuestionnaire(
  permissions: PermissionService,
  actor: User,
): boolean {
  return permissions.has(actor.role, Permission.QuestionnairesDelete);
}

export function canCompleteOnBehalf(
  permissions: PermissionService,
  actor: User,
): boolean {
  return permissions.has(actor.role, Permission.QuestionnairesCompleteAny);
}

export function isElevatedQuestionnaireActor(
  permissions: PermissionService,
  actor: User,
): boolean {
  return (
    canAssignQuestionnaires(permissions, actor) ||
    canManageLifecycle(permissions, actor) ||
    canCompleteOnBehalf(permissions, actor) ||
    canDeleteQuestionnaire(permissions, actor)
  );
}

/**
 * Single type-visibility policy for all assignment read/write paths.
 * Non-owner: caller must already have passed employee/detached scope.
 * Plain owner: full only.
 * Elevated owner (Assign / ManageLifecycle / CompleteAny / Delete): allow all types.
 */
export function canActorAccessAssignmentType(input: {
  actor: User;
  employee: Employee | null;
  templateType: QuestionnaireType | string;
  permissions: PermissionService;
  access: EmployeeAccessService;
}): boolean {
  const { actor, employee, templateType, permissions, access } = input;
  if (!employee) {
    return true;
  }
  const isOwner = access.isOwner(actor, employee);
  if (!isOwner) {
    return true;
  }
  if (isElevatedQuestionnaireActor(permissions, actor)) {
    return true;
  }
  return (EMPLOYEE_OWNER_VISIBLE_QUESTIONNAIRE_TYPES as readonly string[]).includes(
    templateType,
  );
}

export function requireActorAccessAssignmentType(input: {
  actor: User;
  employee: Employee | null;
  templateType: QuestionnaireType | string;
  permissions: PermissionService;
  access: EmployeeAccessService;
}): void {
  if (!canActorAccessAssignmentType(input)) {
    throw new ForbiddenException(
      'Cannot access this questionnaire type',
    );
  }
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
  latestSubmission?: ActiveChangeRequestSubmission | null;
}): QuestionnaireDetailCapabilities {
  const { actor, employee, status, permissions, access, latestSubmission } =
    input;
  const canDelete = canDeleteQuestionnaire(permissions, actor);
  const canAssign = canAssignQuestionnaires(permissions, actor);
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
      ...EMPTY_CAPS,
      canEditDraft: canAssign && onBehalf,
      canDelete,
    };
  }

  if (status === 'closed' || status === 'cancelled') {
    return {
      ...EMPTY_CAPS,
      canDelete,
    };
  }

  if (!employee) {
    return {
      ...EMPTY_CAPS,
      canDelete,
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
    canReviewPerm &&
    canStartRevisionFromStatus(status) &&
    !canEditDraft;

  const canReview =
    canReviewPerm &&
    (status === 'submitted' ||
      status === 'changes_requested' ||
      status === 'reviewed');

  const canResolveChangeRequest =
    canEditDraft &&
    hasActiveReviewerRequest({
      assignmentStatus: status,
      latest: latestSubmission ?? null,
    });

  return {
    canEditDraft,
    canSubmit,
    canReopenSelf,
    canStartRevision,
    canRequestChanges,
    canReview,
    canResolveChangeRequest,
    canDelete,
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
  const canAssign = canAssignQuestionnaires(permissions, actor);
  const canManage = canManageLifecycle(permissions, actor);
  const canDelete = canDeleteQuestionnaire(permissions, actor);
  const attachOk = canAttachAssignment({
    status,
    employeeId,
    detachedFromEmployeeId,
  });

  if (status === 'closed') {
    return {
      canOpen: true,
      canAssign,
      canAttach: false,
      canCancel: false,
      canClose: false,
      canDelete,
    };
  }

  const canAttachNew = status === 'new' && canAssign && attachOk;
  const canAttachReattach =
    status === 'cancelled' && canManage && attachOk;

  return {
    canOpen: true,
    canAssign,
    canAttach: canAttachNew || canAttachReattach,
    canCancel: canManage && canCancelAssignment(status),
    canClose: canManage && canCloseAssignment(status),
    canDelete,
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
