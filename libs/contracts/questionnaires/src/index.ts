import type { EntityId } from '@loom/contracts-common';

export const QUESTIONNAIRE_ASSIGNMENT_STATUSES = [
  'new',
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'reviewed',
  'cancelled',
  'closed',
] as const;

export const QUESTIONNAIRE_TYPES = [
  'full',
  'managing',
  'docs',
] as const;

export type QuestionnaireType = (typeof QUESTIONNAIRE_TYPES)[number];

export type QuestionnaireTypeCatalogEntry = {
  code: QuestionnaireType;
  labelUa: string;
  descriptionUa: string;
};

/** Fail-closed product catalog — single source for labels/descriptions. */
export const QUESTIONNAIRE_TYPE_CATALOG: Record<
  QuestionnaireType,
  QuestionnaireTypeCatalogEntry
> = {
  full: {
    code: 'full',
    labelUa: 'Повна',
    descriptionUa:
      '360 для нових, майбутніх або вже працевлаштованих співробітників',
  },
  managing: {
    code: 'managing',
    labelUa: 'Managing',
    descriptionUa: 'статистика, навички, грейди робітника',
  },
  docs: {
    code: 'docs',
    labelUa: 'Docs',
    descriptionUa: 'які документи, дозволи та інформацію потрібно оформити',
  },
};

/** Types a plain employee-owner may see/fill (not elevated). */
export const EMPLOYEE_OWNER_VISIBLE_QUESTIONNAIRE_TYPES: readonly QuestionnaireType[] =
  ['full'] as const;

export type QuestionnaireAttachmentState =
  | 'new'
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

/** Single SoT for schema + runtime allowlist (`@loom/questionnaire-schema`). */
export const QUESTIONNAIRE_VALUE_TYPES = [
  'text',
  'textarea',
  'date',
  'number',
  'boolean',
  'single_choice',
  'multi_choice',
  'repeating_group',
  'contacts_bundle',
  'position_skills_matrix',
] as const;

export type QuestionnaireValueType =
  (typeof QUESTIONNAIRE_VALUE_TYPES)[number];

export type QuestionnaireSchemaField = {
  key: string;
  label: string;
  valueType: QuestionnaireValueType;
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
  employeeId?: EntityId;
  /** Template code; default employee-360 when omitted. */
  templateCode?: string;
  /** Display title; defaults to template title when omitted/blank. */
  title?: string | null;
  /** Service HR note (not shown to fill owner). */
  comment?: string | null;
  dueAt?: string | null;
};

export type AttachQuestionnaireAssignmentRequest = {
  employeeId: EntityId;
};

export type QuestionnaireAttachConstraint =
  | { kind: 'any_employee' }
  | null;

export type QuestionnaireTemplateListItem = {
  code: string;
  title: string;
  type: QuestionnaireType;
  version: number;
};

export type QuestionnaireTemplateListResponse = {
  items: QuestionnaireTemplateListItem[];
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
  reviewComment: string;
};

export type ResolveQuestionnaireChangesRequest =
  | { outcome: 'completed'; expectedDraftRevision: number }
  | { outcome: 'declined' };

export type QuestionnaireChangeRequestResolution = 'completed' | 'declined';

export type QuestionnaireSubmissionSummary = {
  id: EntityId;
  submissionNumber: number;
  submittedAt: string;
  reviewStatus: QuestionnaireReviewStatus;
  reviewedAt: string | null;
  reviewComment: string | null;
  reviewedByUserId: EntityId | null;
  changeRequestResolution: QuestionnaireChangeRequestResolution | null;
  /** Frozen context at submit; null = legacy registry labels (ADR 0010). */
  context: QuestionnaireContextV1 | null;
};

export type QuestionnaireDraftDto = {
  id: EntityId;
  answers: Record<string, unknown>;
  revision: number;
  updatedAt: string;
};

export type QuestionnaireAssignmentListItem = {
  id: EntityId;
  code: string;
  employeeId: EntityId;
  templateCode: string;
  templateTitle: string;
  templateType: QuestionnaireType;
  version: number;
  status: QuestionnaireAssignmentStatus;
  dueAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  completionPercent: number;
  /** Present only with questionnaires.read_assignment_comment. */
  comment?: string | null;
  latestSubmission: QuestionnaireSubmissionSummary | null;
  capabilities: {
    canOpen: boolean;
    canAssign: boolean;
    canCancel: boolean;
    canClose: boolean;
    canDelete: boolean;
    canStartFill: boolean;
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
  code: string;
  employeeId: EntityId | null;
  /** Display name parts for fill chrome (null when unattached). */
  employeeLastName: string | null;
  employeeFirstName: string | null;
  templateCode: string;
  templateTitle: string;
  templateType: QuestionnaireType;
  version: number;
  status: QuestionnaireAssignmentStatus;
  dueAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Present only with questionnaires.read_assignment_comment. */
  comment?: string | null;
  schema: QuestionnaireSchemaJson;
  draft: QuestionnaireDraftDto | null;
  submissions: QuestionnaireSubmissionSummary[];
  completionPercent: number;
  profileMirror: Record<string, unknown> | null;
  /** Frozen fill context; null = legacy registry mode (ADR 0010). */
  context: QuestionnaireContextV1 | null;
  capabilities: {
    canEditDraft: boolean;
    canSubmit: boolean;
    /** Owner may reopen a submitted/reviewed assignment for further edits. */
    canReopenSelf: boolean;
    /** Admin (CompleteAny) may start a revision; also opens owner edit (shared revision). */
    canStartRevision: boolean;
    canRequestChanges: boolean;
    canReview: boolean;
    /** Actor may resolve an active reviewer change request (completed / declined). */
    canResolveChangeRequest: boolean;
    /** Admin Assign may hard-delete the assignment aggregate. */
    canDelete: boolean;
    canViewAssignmentComment: boolean;
  };
};

export type QuestionnaireDirectoryQuery = {
  departmentId?: EntityId;
  positionId?: EntityId;
  createdFrom?: string;
  createdTo?: string;
  attachmentState?: QuestionnaireAttachmentState;
  templateType?: QuestionnaireType;
  /** Prefix search on assignment.code (ILIKE, wildcards escaped). */
  code?: string;
  status?: QuestionnaireAssignmentStatus;
  sortBy?: QuestionnaireDirectorySortBy;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type QuestionnaireDirectoryItem = {
  id: EntityId;
  code: string;
  templateCode: string;
  templateTitle: string;
  templateType: QuestionnaireType;
  version: number;
  employeeId: EntityId | null;
  employeeDisplayName: string | null;
  departmentName: string | null;
  positionName: string | null;
  status: QuestionnaireAssignmentStatus;
  attachmentState: QuestionnaireAttachmentState;
  createdAt: string;
  /** Last aggregate activity (assignment or draft), not draft-only. */
  updatedAt: string;
  /** Present only with questionnaires.read_assignment_comment. */
  comment?: string | null;
  latestSubmission: QuestionnaireSubmissionSummary | null;
  attachConstraint: QuestionnaireAttachConstraint;
  capabilities: {
    canOpen: boolean;
    canAttach: boolean;
    canCancel: boolean;
    canClose: boolean;
    canDelete: boolean;
    canStartFill: boolean;
  };
};

export type QuestionnaireDirectoryResponse = {
  items: QuestionnaireDirectoryItem[];
  total: number;
  limit: number;
  offset: number;
  capabilities: {
    canCreate: boolean;
  };
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

// ─── Assignment / submission fill context (ADR 0010) ─────────────────

export type PositionSkillContext = {
  code: string;
  labelUa: string;
  group: string;
  targetLevel: number | null;
  required: boolean;
  weight: number | null;
};

export type PositionGoalTemplateContext = {
  goalKind: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

export type PositionDutyContext = {
  title: string;
  description: string | null;
  sortOrder: number;
};

/** Frozen position catalog slice inside QuestionnaireContextV1. */
export type PositionCatalogContextV1 = {
  employeeId: string;
  employmentAssignmentId: string | null;
  positionId: string | null;
  positionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  directionId: string | null;
  directionName: string | null;
  capturedAt: string;
  skills: PositionSkillContext[];
  goalTemplates: PositionGoalTemplateContext[];
  duties: PositionDutyContext[];
};

/**
 * Versioned envelope for questionnaire_assignments.context_json /
 * questionnaire_submissions.context_json. Fail-closed on unknown version.
 */
export type QuestionnaireContextV1 = {
  version: 1;
  positionCatalog: PositionCatalogContextV1;
};

export type QuestionnaireContext = QuestionnaireContextV1;

export function parseQuestionnaireContext(
  raw: unknown,
):
  | { ok: true; context: QuestionnaireContextV1 }
  | { ok: false; error: string } {
  if (raw == null) {
    return { ok: false, error: 'context is null' };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'context must be an object' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj['version'] !== 1) {
    return {
      ok: false,
      error: `unsupported context version: ${String(obj['version'])}`,
    };
  }
  const pc = obj['positionCatalog'];
  if (pc == null || typeof pc !== 'object' || Array.isArray(pc)) {
    return { ok: false, error: 'positionCatalog missing or invalid' };
  }
  return { ok: true, context: raw as QuestionnaireContextV1 };
}
