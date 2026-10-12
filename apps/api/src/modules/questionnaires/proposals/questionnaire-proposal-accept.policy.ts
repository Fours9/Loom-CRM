import type { AuthorizationContext } from '../../../platform/access-control/authorization-context';
import {
  canEditEmergencyOnTarget,
  canManageProfilesOnTarget,
  canWritePersonalOnTarget,
} from '../../../organization/employees/employee-profile-authz';
import type { StoredQuestionnaireProposedChange } from './questionnaire-proposed-change';

export type ProposalAcceptRequirement =
  | 'basic'
  | 'personal'
  | 'emergency'
  | 'skill';

/**
 * Exhaustive fail-closed classifier.
 * Unknown kind / section.field → null (DENY). Never default to basic ManageProfiles.
 */
export function classifyProposalProfileWrite(
  change: StoredQuestionnaireProposedChange,
): ProposalAcceptRequirement | null {
  if (change.kind === 'add_skill') {
    return 'skill';
  }
  if (change.kind !== 'field_update') {
    return null;
  }

  switch (`${change.section}.${change.field}`) {
    case 'overview.firstName':
    case 'overview.lastName':
    case 'overview.middleName':
    case 'overview.preferredName':
    case 'header.preferredName':
    case 'contacts.workEmail':
    case 'contacts.workPhone':
    case 'contacts.workTelegram':
    case 'employment.directionId':
    case 'employment.departmentId':
    case 'employment.positionId':
      return 'basic';
    case 'personal.birthDate':
    case 'personal.city':
    case 'personal.preferredLanguage':
    case 'contacts.personal_replace':
      return 'personal';
    case 'contacts.emergency_replace':
      return 'emergency';
    default:
      return null;
  }
}

export function canAcceptQuestionnaireProfileProposal(input: {
  authz: AuthorizationContext;
  inManagedDept: boolean;
  change: StoredQuestionnaireProposedChange;
}): boolean {
  if (input.authz.isAdminEquivalent) return true;

  const requirement = classifyProposalProfileWrite(input.change);
  if (!requirement) return false;

  switch (requirement) {
    case 'basic':
    case 'skill':
      return canManageProfilesOnTarget(input.authz, input.inManagedDept);
    case 'personal':
      return canWritePersonalOnTarget(input.authz, input.inManagedDept);
    case 'emergency':
      return canEditEmergencyOnTarget(
        input.authz,
        input.inManagedDept,
        false,
      );
  }
}
