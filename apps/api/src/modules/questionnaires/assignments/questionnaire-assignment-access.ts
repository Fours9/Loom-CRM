import { ForbiddenException } from '@nestjs/common';
import {
  isQuestionnairePostSubmitStatus,
} from '@loom/contracts-questionnaires';
import { Permission } from '../../../platform/permissions/permission.names';
import {
  hasPermission,
  hasQuestionnaireTemplate,
  type AuthorizationContext,
} from '../../../platform/access-control/authorization-context';
import type { EmployeeAccessService } from '../../../organization/access/employee-access.service';
import type { Employee } from '../../../organization/employees/employee.entity';
import type { User } from '../../../platform/identity/user.entity';
import type { QuestionnaireAssignment } from '../questionnaire-assignment.entity';
import type { QuestionnaireAssignmentStatus } from '../questionnaire.enums';
import {
  canAttachAssignment,
  canCancelAssignment,
  canCloseAssignment,
  canStartRevisionFromState,
  isOwnerEditableStatus,
} from './questionnaire-assignment-transitions';
import {
  hasActiveReviewerRequest,
  type ActiveChangeRequestSubmission,
} from '../reopen/questionnaire-active-change-request';
import type { SelectQueryBuilder } from 'typeorm';

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
  canStartFill: boolean;
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

export function canAssignQuestionnaires(authz: AuthorizationContext): boolean {
  return hasPermission(authz, Permission.QuestionnairesAssign);
}

export function canManageLifecycle(authz: AuthorizationContext): boolean {
  return hasPermission(authz, Permission.QuestionnairesManageLifecycle);
}

export function canDeleteQuestionnaire(authz: AuthorizationContext): boolean {
  return hasPermission(authz, Permission.QuestionnairesDelete);
}

export function canCompleteOnBehalf(authz: AuthorizationContext): boolean {
  return hasPermission(authz, Permission.QuestionnairesCompleteAny);
}

export function canCompleteSelf(authz: AuthorizationContext): boolean {
  return hasPermission(authz, Permission.QuestionnairesCompleteSelf);
}

export function canReviewQuestionnaires(authz: AuthorizationContext): boolean {
  return hasPermission(authz, Permission.QuestionnairesReview);
}

export function canApplyProfileChanges(authz: AuthorizationContext): boolean {
  return hasPermission(authz, Permission.QuestionnairesApplyProfileChanges);
}

export function canReadAssignmentComment(authz: AuthorizationContext): boolean {
  return hasPermission(authz, Permission.QuestionnairesReadAssignmentComment);
}

export function canViewQuestionnaires(authz: AuthorizationContext): boolean {
  return hasPermission(authz, Permission.QuestionnairesView);
}

/** Unattached new-pool READ: Assign ∨ Lifecycle ∨ Delete (∨ adminEq via hasPermission). */
export function canReadUnattachedNewPool(authz: AuthorizationContext): boolean {
  return (
    canAssignQuestionnaires(authz) ||
    canManageLifecycle(authz) ||
    canDeleteQuestionnaire(authz)
  );
}

/**
 * Single template-code visibility policy for every assignment-touching path.
 * Scope is checked separately; this only gates by granted template codes.
 */
export function canActorAccessAssignmentTemplate(input: {
  authz: AuthorizationContext;
  templateCode: string;
}): boolean {
  return hasQuestionnaireTemplate(input.authz, input.templateCode);
}

export function requireActorAccessAssignmentTemplate(input: {
  authz: AuthorizationContext;
  templateCode: string;
}): void {
  if (!canActorAccessAssignmentTemplate(input)) {
    throw new ForbiddenException('Cannot access this questionnaire template');
  }
}

/** Fail-closed SQL filter for granted template codes (never empty IN (...)). */
export function applyGrantedTemplateCodeFilter(
  qb: SelectQueryBuilder<QuestionnaireAssignment>,
  authz: AuthorizationContext,
  templateAlias = 'tmpl',
): void {
  if (authz.isAdminEquivalent) return;
  if (authz.questionnaireTemplateCodes.length === 0) {
    qb.andWhere('1 = 0');
    return;
  }
  qb.andWhere(`${templateAlias}.code IN (:...questionnaireTemplateCodes)`, {
    questionnaireTemplateCodes: authz.questionnaireTemplateCodes,
  });
}

export function filterByGrantedTemplateCodes<T extends { templateCode: string }>(
  items: T[],
  authz: AuthorizationContext,
): T[] {
  if (authz.isAdminEquivalent) return items;
  const allowed = new Set(authz.questionnaireTemplateCodes);
  return items.filter((item) => allowed.has(item.templateCode));
}

/**
 * Single source for detail draft/submit/revision/delete capabilities.
 * Lifecycle list capabilities are projected separately.
 */
export function computeDetailCapabilities(input: {
  authz: AuthorizationContext;
  actor: User;
  employee: Employee | null;
  status: QuestionnaireAssignmentStatus | string;
  access: EmployeeAccessService;
  latestSubmission?: ActiveChangeRequestSubmission | null;
}): QuestionnaireDetailCapabilities {
  const { authz, actor, employee, status, access, latestSubmission } = input;
  const canDelete = canDeleteQuestionnaire(authz);
  const canAssign = canAssignQuestionnaires(authz);
  const onBehalf = canCompleteOnBehalf(authz);
  const canReviewPerm = canReviewQuestionnaires(authz);
  const completeSelf = canCompleteSelf(authz);

  if (status === 'new') {
    return {
      ...EMPTY_CAPS,
      canEditDraft: canAssign && onBehalf,
      canDelete,
    };
  }

  if (status === 'cancelled') {
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
    isOwner && completeSelf && isOwnerEditableStatus(status);

  const onBehalfEdit = onBehalf && isOwnerEditableStatus(status);

  const canEditDraft = ownerEdit || onBehalfEdit;
  const canSubmit = canEditDraft;

  const revisionEligible = canStartRevisionFromState({
    status,
    latestSubmission: latestSubmission ?? null,
  });

  const canReopenSelf = isOwner && completeSelf && revisionEligible;

  const canStartRevision = onBehalf && revisionEligible;

  const canRequestChanges =
    canReviewPerm && revisionEligible && !canEditDraft;

  const canReview =
    canReviewPerm &&
    isQuestionnairePostSubmitStatus(String(status)) &&
    latestSubmission?.reviewStatus === 'pending';

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
  authz: AuthorizationContext;
  actor: User;
  status: QuestionnaireAssignmentStatus | string;
  employeeId: string | null | undefined;
  detachedFromEmployeeId: string | null | undefined;
  employee: Employee | null;
  access: EmployeeAccessService;
  hasLatestSubmission: boolean;
}): QuestionnaireListLifecycleCapabilities {
  const {
    authz,
    actor,
    status,
    employeeId,
    detachedFromEmployeeId,
    employee,
    access,
    hasLatestSubmission,
  } = input;
  const canAssign = canAssignQuestionnaires(authz);
  const canManage = canManageLifecycle(authz);
  const canDelete = canDeleteQuestionnaire(authz);
  const attachOk = canAttachAssignment({
    status,
    employeeId,
    detachedFromEmployeeId,
  });
  const canStartFill = computeCanStartFill({
    authz,
    actor,
    employee,
    status,
    access,
    hasLatestSubmission,
  });

  if (status === 'closed') {
    return {
      canOpen: true,
      canAssign,
      canAttach: false,
      canCancel: canManage && canCancelAssignment(status),
      canClose: false,
      canDelete,
      canStartFill: false,
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
    canStartFill,
  };
}

/** First-fill CTA: same canEditDraft rules as detail, no prior submissions. */
export function computeCanStartFill(input: {
  authz: AuthorizationContext;
  actor: User;
  employee: Employee | null;
  status: QuestionnaireAssignmentStatus | string;
  access: EmployeeAccessService;
  hasLatestSubmission: boolean;
}): boolean {
  if (input.hasLatestSubmission) return false;
  if (input.status !== 'assigned' && input.status !== 'in_progress') {
    return false;
  }
  return computeDetailCapabilities({
    authz: input.authz,
    actor: input.actor,
    employee: input.employee,
    status: input.status,
    access: input.access,
  }).canEditDraft;
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
