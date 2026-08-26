/**
 * Pure write-path decision for People matrix level upsert.
 * Keeps HTTP/TX out of the policy so it stays testable.
 */
export type SkillMatrixUpsertDecision =
  | { action: 'update_existing' }
  | { action: 'insert_requirement' }
  | { action: 'reject_not_on_matrix'; reason: 'not_requirement_and_no_assessment' };

export function decideSkillMatrixUpsert(input: {
  hasConfirmedAssessment: boolean;
  isCurrentRequirement: boolean;
}): SkillMatrixUpsertDecision {
  if (input.hasConfirmedAssessment) {
    return { action: 'update_existing' };
  }
  if (input.isCurrentRequirement) {
    return { action: 'insert_requirement' };
  }
  return {
    action: 'reject_not_on_matrix',
    reason: 'not_requirement_and_no_assessment',
  };
}
