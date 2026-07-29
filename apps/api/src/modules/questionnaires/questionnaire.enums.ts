export const QUESTIONNAIRE_ASSIGNMENT_STATUSES = [
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'reviewed',
  'cancelled',
] as const;

export type QuestionnaireAssignmentStatus =
  (typeof QUESTIONNAIRE_ASSIGNMENT_STATUSES)[number];

export const QUESTIONNAIRE_TEMPLATE_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;

export type QuestionnaireTemplateStatus =
  (typeof QUESTIONNAIRE_TEMPLATE_STATUSES)[number];

export const QUESTIONNAIRE_PROPOSAL_STATUSES = [
  'pending',
  'accepted',
  'rejected',
] as const;

export type QuestionnaireProposalStatus =
  (typeof QUESTIONNAIRE_PROPOSAL_STATUSES)[number];

export const QUESTIONNAIRE_REVIEW_STATUSES = [
  'pending',
  'changes_requested',
  'approved',
] as const;

export type QuestionnaireReviewStatus =
  (typeof QUESTIONNAIRE_REVIEW_STATUSES)[number];
