import type { EntityId } from '@loom/contracts-common';

export const QUESTIONNAIRE_ASSIGNMENT_STATUSES = [
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'reviewed',
  'cancelled',
  'closed',
] as const;

export type QuestionnaireAttachmentState =
  | 'attached'
  | 'detached'
  | 'closed';

export const QUESTIONNAIRE_DIRECTORY_SORT_BY = [
  'createdAt',
  'updatedAt',
  'employeeName',
  'departmentName',
  'positionName',
  'templateCode',
  'status',
] as const;

export type QuestionnaireDirectorySortBy =
  (typeof QUESTIONNAIRE_DIRECTORY_SORT_BY)[number];

export type QuestionnaireAssignmentStatus =
  (typeof QUESTIONNAIRE_ASSIGNMENT_STATUSES)[number];

export const QUESTIONNAIRE_PROPOSAL_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'superseded',
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

export type QuestionnaireConditionValue = string | number | boolean | null;

/** Strict union: equals XOR includes (never both). */
export type QuestionnaireVisibleWhen =
  | {
      answerKey: string;
      equals: QuestionnaireConditionValue;
      includes?: never;
    }
  | {
      answerKey: string;
      includes: QuestionnaireConditionValue;
      equals?: never;
    };

export type QuestionnaireSchemaField = {
  key: string;
  label: string;
  valueType: string;
  helpText?: string;
  requiredPolicy?: string;
  /** Boolean: default radio; `checkbox` for confirmations only. */
  uiControl?: 'radio' | 'checkbox';
  min?: number;
  max?: number;
  minItems?: number;
  maxItems?: number;
  options?: Array<{ value: string; label: string }>;
  children?: QuestionnaireSchemaField[];
  createsProfileProposal?: boolean;
  proposalMapping?: { section: string; field: string };
  visibleWhen?: QuestionnaireVisibleWhen;
  uiGroup?: string;
  uiGroupLabel?: string;
  uiLayout?: 'row' | 'stack';
  /** Display-only default from another answer key (not written to draft). */
  defaultFromAnswerKey?: string;
};

export type QuestionnaireSchemaStep = {
  key: string;
  label: string;
  fields: QuestionnaireSchemaField[];
};

export type QuestionnaireSchemaJson = {
  code: string;
  version: number;
  title: string;
  steps: QuestionnaireSchemaStep[];
};

export type CreateQuestionnaireAssignmentRequest = {
  employeeId: EntityId;
  templateCode?: string;
  dueAt?: string | null;
};

export type PatchQuestionnaireDraftRequest = {
  answers: Record<string, unknown>;
  revision: number;
};

export type ReviewQuestionnaireSubmissionRequest = {
  reviewStatus: 'approved' | 'changes_requested';
  reviewComment?: string | null;
};

export type RequestQuestionnaireChangesRequest = {
  reviewComment?: string | null;
};

export type QuestionnaireSubmissionSummary = {
  id: EntityId;
  submissionNumber: number;
  submittedAt: string;
  reviewStatus: QuestionnaireReviewStatus;
  reviewedAt: string | null;
  reviewComment: string | null;
};

export type QuestionnaireDraftDto = {
  id: EntityId;
  answers: Record<string, unknown>;
  revision: number;
  updatedAt: string;
};

export type QuestionnaireAssignmentListItem = {
  id: EntityId;
  employeeId: EntityId;
  templateCode: string;
  templateTitle: string;
  version: number;
  status: QuestionnaireAssignmentStatus;
  dueAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  completionPercent: number;
  latestSubmission: QuestionnaireSubmissionSummary | null;
  capabilities: {
    canOpen: boolean;
    canAssign: boolean;
    canCancel: boolean;
    canReactivate: boolean;
    canClose: boolean;
    canDelete: boolean;
  };
};

export type QuestionnaireAssignmentListResponse = {
  items: QuestionnaireAssignmentListItem[];
  capabilities: {
    canAssign: boolean;
  };
};

export type QuestionnaireAssignmentDetail = {
  id: EntityId;
  employeeId: EntityId;
  /** Display name parts for fill chrome (overview; always when assignment is viewable). */
  employeeLastName: string;
  employeeFirstName: string;
  templateCode: string;
  templateTitle: string;
  version: number;
  status: QuestionnaireAssignmentStatus;
  dueAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  schema: QuestionnaireSchemaJson;
  draft: QuestionnaireDraftDto | null;
  submissions: QuestionnaireSubmissionSummary[];
  completionPercent: number;
  profileMirror: Record<string, unknown> | null;
  capabilities: {
    canEditDraft: boolean;
    canSubmit: boolean;
    /** Owner may reopen a submitted/reviewed assignment for further edits. */
    canReopenSelf: boolean;
    /** Admin (CompleteAny) may start a revision; also opens owner edit (shared revision). */
    canStartRevision: boolean;
    canRequestChanges: boolean;
    canReview: boolean;
    /** Admin Assign may hard-delete the assignment aggregate. */
    canDelete: boolean;
  };
};

export type QuestionnaireDirectoryQuery = {
  departmentId?: EntityId;
  positionId?: EntityId;
  createdFrom?: string;
  createdTo?: string;
  attachmentState?: QuestionnaireAttachmentState;
  sortBy?: QuestionnaireDirectorySortBy;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type QuestionnaireDirectoryItem = {
  id: EntityId;
  templateCode: string;
  templateTitle: string;
  version: number;
  employeeId: EntityId;
  employeeDisplayName: string;
  departmentName: string | null;
  positionName: string | null;
  status: QuestionnaireAssignmentStatus;
  attachmentState: QuestionnaireAttachmentState;
  createdAt: string;
  /** Last aggregate activity (assignment or draft), not draft-only. */
  updatedAt: string;
  capabilities: {
    canOpen: boolean;
    canCancel: boolean;
    canReactivate: boolean;
    canClose: boolean;
    canDelete: boolean;
  };
};

export type QuestionnaireDirectoryResponse = {
  items: QuestionnaireDirectoryItem[];
  total: number;
  limit: number;
  offset: number;
};

export type QuestionnaireProposedChange = {
  section: string;
  field: string;
  answerKey: string;
  from: unknown;
  to: unknown;
};

export type QuestionnaireProfileProposalItem = {
  id: EntityId;
  submissionId: EntityId;
  /** Assignment that produced this proposal (via submission → response). */
  assignmentId: EntityId;
  employeeId: EntityId;
  targetSection: string;
  proposedChanges: QuestionnaireProposedChange;
  status: QuestionnaireProposalStatus;
  reviewedByUserId: EntityId | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type QuestionnaireProfileProposalListResponse = {
  items: QuestionnaireProfileProposalItem[];
  capabilities: {
    canApply: boolean;
  };
};

/** Snapshot sections shown in read-only People summary (PR-7). */
export type QuestionnaireSnapshotSummary = {
  submittedAt: string | null;
  experience: Record<string, unknown> | null;
  education: Record<string, unknown> | null;
  strengths: Record<string, unknown> | null;
  hobbies: Record<string, unknown> | null;
  workStyle: Record<string, unknown> | null;
};
