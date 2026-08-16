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

const CONTEXT_ROOT_KEYS = new Set(['version', 'positionCatalog']);
const POSITION_CATALOG_KEYS = new Set([
  'employeeId',
  'employmentAssignmentId',
  'positionId',
  'positionName',
  'departmentId',
  'departmentName',
  'directionId',
  'directionName',
  'capturedAt',
  'skills',
  'goalTemplates',
  'duties',
]);
const SKILL_ITEM_KEYS = new Set([
  'code',
  'labelUa',
  'group',
  'targetLevel',
  'required',
  'weight',
]);
const GOAL_ITEM_KEYS = new Set([
  'goalKind',
  'title',
  'description',
  'sortOrder',
]);
const DUTY_ITEM_KEYS = new Set(['title', 'description', 'sortOrder']);

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownKeys(
  obj: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): string | null {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      return `unknown property ${path}.${key}`;
    }
  }
  return null;
}

function expectString(
  value: unknown,
  path: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string') {
    return fail(`${path} must be a string`);
  }
  return { ok: true, value };
}

function expectNullableString(
  value: unknown,
  path: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value !== null && typeof value !== 'string') {
    return fail(`${path} must be a string or null`);
  }
  return { ok: true, value: value as string | null };
}

function expectNullableNumber(
  value: unknown,
  path: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value !== null && typeof value !== 'number') {
    return fail(`${path} must be a number or null`);
  }
  return { ok: true, value: value as number | null };
}

function parseSkillItem(
  raw: unknown,
  path: string,
): { ok: true; value: PositionSkillContext } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return fail(`${path} must be an object`);
  }
  const unknown = rejectUnknownKeys(raw, SKILL_ITEM_KEYS, path);
  if (unknown) return fail(unknown);

  const code = expectString(raw['code'], `${path}.code`);
  if (!code.ok) return code;
  const labelUa = expectString(raw['labelUa'], `${path}.labelUa`);
  if (!labelUa.ok) return labelUa;
  const group = expectString(raw['group'], `${path}.group`);
  if (!group.ok) return group;
  const targetLevel = expectNullableNumber(
    raw['targetLevel'],
    `${path}.targetLevel`,
  );
  if (!targetLevel.ok) return targetLevel;
  if (typeof raw['required'] !== 'boolean') {
    return fail(`${path}.required must be a boolean`);
  }
  const weight = expectNullableNumber(raw['weight'], `${path}.weight`);
  if (!weight.ok) return weight;

  return {
    ok: true,
    value: {
      code: code.value,
      labelUa: labelUa.value,
      group: group.value,
      targetLevel: targetLevel.value,
      required: raw['required'],
      weight: weight.value,
    },
  };
}

function parseGoalItem(
  raw: unknown,
  path: string,
):
  | { ok: true; value: PositionGoalTemplateContext }
  | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return fail(`${path} must be an object`);
  }
  const unknown = rejectUnknownKeys(raw, GOAL_ITEM_KEYS, path);
  if (unknown) return fail(unknown);

  const goalKind = expectString(raw['goalKind'], `${path}.goalKind`);
  if (!goalKind.ok) return goalKind;
  const title = expectString(raw['title'], `${path}.title`);
  if (!title.ok) return title;
  const description = expectNullableString(
    raw['description'],
    `${path}.description`,
  );
  if (!description.ok) return description;
  if (typeof raw['sortOrder'] !== 'number') {
    return fail(`${path}.sortOrder must be a number`);
  }

  return {
    ok: true,
    value: {
      goalKind: goalKind.value,
      title: title.value,
      description: description.value,
      sortOrder: raw['sortOrder'],
    },
  };
}

function parseDutyItem(
  raw: unknown,
  path: string,
): { ok: true; value: PositionDutyContext } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return fail(`${path} must be an object`);
  }
  const unknown = rejectUnknownKeys(raw, DUTY_ITEM_KEYS, path);
  if (unknown) return fail(unknown);

  const title = expectString(raw['title'], `${path}.title`);
  if (!title.ok) return title;
  const description = expectNullableString(
    raw['description'],
    `${path}.description`,
  );
  if (!description.ok) return description;
  if (typeof raw['sortOrder'] !== 'number') {
    return fail(`${path}.sortOrder must be a number`);
  }

  return {
    ok: true,
    value: {
      title: title.value,
      description: description.value,
      sortOrder: raw['sortOrder'],
    },
  };
}

/**
 * Strict fail-closed parser for frozen questionnaire context.
 * Rejects unknown keys and incomplete positionCatalog shapes.
 * Note: `raw === null` is not "legacy" here — callers treat DB null separately;
 * this function returns ok:false for null.
 */
export function parseQuestionnaireContext(
  raw: unknown,
):
  | { ok: true; context: QuestionnaireContextV1 }
  | { ok: false; error: string } {
  if (raw == null) {
    return fail('context is null');
  }
  if (!isPlainObject(raw)) {
    return fail('context must be an object');
  }
  const unknownRoot = rejectUnknownKeys(raw, CONTEXT_ROOT_KEYS, 'context');
  if (unknownRoot) return fail(unknownRoot);

  if (raw['version'] !== 1) {
    return fail(`unsupported context version: ${String(raw['version'])}`);
  }

  const pcRaw = raw['positionCatalog'];
  if (!isPlainObject(pcRaw)) {
    return fail('positionCatalog missing or invalid');
  }
  const unknownPc = rejectUnknownKeys(
    pcRaw,
    POSITION_CATALOG_KEYS,
    'positionCatalog',
  );
  if (unknownPc) return fail(unknownPc);

  const employeeId = expectString(pcRaw['employeeId'], 'positionCatalog.employeeId');
  if (!employeeId.ok) return employeeId;
  const employmentAssignmentId = expectNullableString(
    pcRaw['employmentAssignmentId'],
    'positionCatalog.employmentAssignmentId',
  );
  if (!employmentAssignmentId.ok) return employmentAssignmentId;
  const positionId = expectNullableString(
    pcRaw['positionId'],
    'positionCatalog.positionId',
  );
  if (!positionId.ok) return positionId;
  const positionName = expectNullableString(
    pcRaw['positionName'],
    'positionCatalog.positionName',
  );
  if (!positionName.ok) return positionName;
  const departmentId = expectNullableString(
    pcRaw['departmentId'],
    'positionCatalog.departmentId',
  );
  if (!departmentId.ok) return departmentId;
  const departmentName = expectNullableString(
    pcRaw['departmentName'],
    'positionCatalog.departmentName',
  );
  if (!departmentName.ok) return departmentName;
  const directionId = expectNullableString(
    pcRaw['directionId'],
    'positionCatalog.directionId',
  );
  if (!directionId.ok) return directionId;
  const directionName = expectNullableString(
    pcRaw['directionName'],
    'positionCatalog.directionName',
  );
  if (!directionName.ok) return directionName;
  const capturedAt = expectString(
    pcRaw['capturedAt'],
    'positionCatalog.capturedAt',
  );
  if (!capturedAt.ok) return capturedAt;

  if (!Array.isArray(pcRaw['skills'])) {
    return fail('positionCatalog.skills must be an array');
  }
  if (!Array.isArray(pcRaw['goalTemplates'])) {
    return fail('positionCatalog.goalTemplates must be an array');
  }
  if (!Array.isArray(pcRaw['duties'])) {
    return fail('positionCatalog.duties must be an array');
  }

  const skills: PositionSkillContext[] = [];
  for (let i = 0; i < pcRaw['skills'].length; i += 1) {
    const item = parseSkillItem(pcRaw['skills'][i], `positionCatalog.skills[${i}]`);
    if (!item.ok) return item;
    skills.push(item.value);
  }

  const goalTemplates: PositionGoalTemplateContext[] = [];
  for (let i = 0; i < pcRaw['goalTemplates'].length; i += 1) {
    const item = parseGoalItem(
      pcRaw['goalTemplates'][i],
      `positionCatalog.goalTemplates[${i}]`,
    );
    if (!item.ok) return item;
    goalTemplates.push(item.value);
  }

  const duties: PositionDutyContext[] = [];
  for (let i = 0; i < pcRaw['duties'].length; i += 1) {
    const item = parseDutyItem(
      pcRaw['duties'][i],
      `positionCatalog.duties[${i}]`,
    );
    if (!item.ok) return item;
    duties.push(item.value);
  }

  return {
    ok: true,
    context: {
      version: 1,
      positionCatalog: {
        employeeId: employeeId.value,
        employmentAssignmentId: employmentAssignmentId.value,
        positionId: positionId.value,
        positionName: positionName.value,
        departmentId: departmentId.value,
        departmentName: departmentName.value,
        directionId: directionId.value,
        directionName: directionName.value,
        capturedAt: capturedAt.value,
        skills,
        goalTemplates,
        duties,
      },
    },
  };
}

/**
 * Resolve matrix allowlist from assignment/submission context_json.
 * - DB null → undefined (legacy_registry)
 * - valid context → skill codes array (may be empty = deny all catalog skills)
 * - non-null invalid → ok:false (caller must fail closed, not treat as legacy)
 */
export function resolveAllowedSkillCodesFromContextJson(
  raw: unknown,
):
  | { ok: true; allowedSkillCodes: readonly string[] | undefined }
  | { ok: false; error: string } {
  if (raw == null) {
    return { ok: true, allowedSkillCodes: undefined };
  }
  const parsed = parseQuestionnaireContext(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  return {
    ok: true,
    allowedSkillCodes: parsed.context.positionCatalog.skills.map((s) => s.code),
  };
}
