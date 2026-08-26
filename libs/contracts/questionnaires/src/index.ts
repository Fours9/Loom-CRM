import type { EntityId } from '@loom/contracts-common';
import {
  isSkillIdentityCode,
  isSkillScaleKind,
  validateSkillScaleBounds,
} from '@loom/position-skill-catalog';

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
  'organization_ref',
] as const;

export type QuestionnaireValueType =
  (typeof QUESTIONNAIRE_VALUE_TYPES)[number];

export type OrganizationEntityKind =
  | 'direction'
  | 'department'
  | 'position'
  | 'work_format'
  | 'employment_type';

export type ProfileMirrorKey =
  | 'lastName'
  | 'firstName'
  | 'middleName'
  | 'preferredName'
  | 'birthDate'
  | 'city'
  | 'preferredLanguage'
  | 'personal_phone'
  | 'personal_phone_secondary'
  | 'personal_email'
  | 'personal_telegram'
  | 'contactsBundle'
  | 'directionId'
  | 'departmentId'
  | 'positionId'
  | 'workFormat'
  | 'employmentType'
  | 'startDate'
  | 'probationEndDate';

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
  /** Display default from assignment.profileMirror (not a profile proposal). */
  profileMirrorKey?: ProfileMirrorKey;
  /** For valueType organization_ref. */
  organizationEntity?: OrganizationEntityKind;
  /** Cascade parent answer key for organization_ref (e.g. company_work.direction_id). */
  cascadeParentKey?: string;
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
  context: QuestionnaireContext | null;
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
  context: QuestionnaireContext | null;
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

export type QuestionnaireProposedChange =
  | {
      kind: 'field_update';
      section: string;
      field: string;
      answerKey: string;
      from: unknown;
      to: unknown;
    }
  | {
      kind: 'add_skill';
      section: 'skills';
      /** skillCode — supersede identity among skill proposals */
      field: string;
      skillId: string;
      skillCode: string;
      labelUa: string;
      proposedLevel: number | null;
      /** Frozen context skill scale at submit — never live Skill at generate time */
      sourceScale: {
        kind: 'range' | 'percent';
        min: number;
        max: number;
      };
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

export type PositionSkillSource =
  | 'position_requirement'
  | 'questionnaire_extra';

export type PositionSkillContext = {
  code: string;
  labelUa: string;
  group: string;
  targetLevel: number | null;
  required: boolean;
  weight: number | null;
  /**
   * Exact catalog row id. Required on Context V2; absent on historical V1.
   * `code` remains the questionnaire answer identity.
   */
  skillId?: string;
  scaleKind?: 'range' | 'percent';
  scaleMin?: number;
  scaleMax?: number;
  /** Present on Context V2 skills; absent on historical V1. */
  source?: PositionSkillSource;
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

/** Frozen position catalog slice inside QuestionnaireContextV1/V2. */
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
 * V1 = historical; new captures after Context V2 deploy use version 2.
 */
export type QuestionnaireContextV1 = {
  version: 1;
  positionCatalog: PositionCatalogContextV1;
};

export type QuestionnaireContextV2 = {
  version: 2;
  positionCatalog: PositionCatalogContextV1;
};

export type QuestionnaireContext =
  | QuestionnaireContextV1
  | QuestionnaireContextV2;

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
  'skillId',
  'scaleKind',
  'scaleMin',
  'scaleMax',
  'source',
]);
const SKILL_SOURCES = new Set<PositionSkillSource>([
  'position_requirement',
  'questionnaire_extra',
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidString(value: string): boolean {
  return UUID_RE.test(value);
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

function expectNullableInteger(
  value: unknown,
  path: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return fail(`${path} must be an integer or null`);
  }
  return { ok: true, value };
}

function parseSkillItem(
  raw: unknown,
  path: string,
  requireSource: boolean,
): { ok: true; value: PositionSkillContext } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return fail(`${path} must be an object`);
  }
  const unknown = rejectUnknownKeys(raw, SKILL_ITEM_KEYS, path);
  if (unknown) return fail(unknown);

  const code = expectString(raw['code'], `${path}.code`);
  if (!code.ok) return code;
  if (!isSkillIdentityCode(code.value)) {
    return fail(`${path}.code is not a valid skill identity`);
  }
  const labelUa = expectString(raw['labelUa'], `${path}.labelUa`);
  if (!labelUa.ok) return labelUa;
  const group = expectString(raw['group'], `${path}.group`);
  if (!group.ok) return group;
  const targetLevel = expectNullableInteger(
    raw['targetLevel'],
    `${path}.targetLevel`,
  );
  if (!targetLevel.ok) return targetLevel;
  if (typeof raw['required'] !== 'boolean') {
    return fail(`${path}.required must be a boolean`);
  }
  const weight = expectNullableNumber(raw['weight'], `${path}.weight`);
  if (!weight.ok) return weight;

  const hasKind = raw['scaleKind'] !== undefined;
  const hasMin = raw['scaleMin'] !== undefined;
  const hasMax = raw['scaleMax'] !== undefined;
  const scalePresent = hasKind || hasMin || hasMax;
  if (scalePresent && !(hasKind && hasMin && hasMax)) {
    return fail(
      `${path} scaleKind, scaleMin and scaleMax must all be present together`,
    );
  }

  const value: PositionSkillContext = {
    code: code.value,
    labelUa: labelUa.value,
    group: group.value,
    targetLevel: targetLevel.value,
    required: raw['required'],
    weight: weight.value,
  };

  if (requireSource) {
    // Context V2: skillId + full native scale required.
    const skillId = expectString(raw['skillId'], `${path}.skillId`);
    if (!skillId.ok) return skillId;
    if (!isUuidString(skillId.value)) {
      return fail(`${path}.skillId must be a UUID`);
    }
    value.skillId = skillId.value;
    if (!scalePresent) {
      return fail(
        `${path} scaleKind, scaleMin and scaleMax are required on context version 2`,
      );
    }
  } else if (raw['skillId'] !== undefined) {
    return fail(`${path}.skillId is not allowed on context version 1`);
  }

  if (scalePresent) {
    const scaleKind = raw['scaleKind'];
    const scaleMin = raw['scaleMin'];
    const scaleMax = raw['scaleMax'];
    if (!isSkillScaleKind(scaleKind)) {
      return fail(`${path}.scaleKind must be range or percent`);
    }
    if (typeof scaleMin !== 'number' || !Number.isInteger(scaleMin)) {
      return fail(`${path}.scaleMin must be an integer`);
    }
    if (typeof scaleMax !== 'number' || !Number.isInteger(scaleMax)) {
      return fail(`${path}.scaleMax must be an integer`);
    }
    const bounds = validateSkillScaleBounds(scaleKind, scaleMin, scaleMax);
    if (!bounds.ok) return fail(`${path}: ${bounds.error}`);
    if (
      targetLevel.value != null &&
      (targetLevel.value < scaleMin || targetLevel.value > scaleMax)
    ) {
      return fail(`${path}.targetLevel is outside scale bounds`);
    }
    value.scaleKind = scaleKind;
    value.scaleMin = scaleMin;
    value.scaleMax = scaleMax;
  }

  if (requireSource) {
    const source = raw['source'];
    if (typeof source !== 'string' || !SKILL_SOURCES.has(source as PositionSkillSource)) {
      return fail(
        `${path}.source must be position_requirement or questionnaire_extra`,
      );
    }
    value.source = source as PositionSkillSource;
  } else if (raw['source'] !== undefined) {
    return fail(`${path}.source is not allowed on context version 1`);
  }

  return { ok: true, value };
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
 * Accepts version 1 (historical) and version 2 (skills require `source`).
 * Note: `raw === null` is not "legacy" here — callers treat DB null separately;
 * this function returns ok:false for null.
 */
export function parseQuestionnaireContext(
  raw: unknown,
):
  | { ok: true; context: QuestionnaireContext }
  | { ok: false; error: string } {
  if (raw == null) {
    return fail('context is null');
  }
  if (!isPlainObject(raw)) {
    return fail('context must be an object');
  }
  const unknownRoot = rejectUnknownKeys(raw, CONTEXT_ROOT_KEYS, 'context');
  if (unknownRoot) return fail(unknownRoot);

  const version = raw['version'];
  if (version !== 1 && version !== 2) {
    return fail(`unsupported context version: ${String(version)}`);
  }
  const requireSkillSource = version === 2;

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
    const item = parseSkillItem(
      pcRaw['skills'][i],
      `positionCatalog.skills[${i}]`,
      requireSkillSource,
    );
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

  const positionCatalog: PositionCatalogContextV1 = {
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
  };

  if (version === 2) {
    return { ok: true, context: { version: 2, positionCatalog } };
  }
  return { ok: true, context: { version: 1, positionCatalog } };
}

/** Partition skill codes from a parsed context for sync set-algebra. */
export function classifyContextSkillCodes(context: QuestionnaireContext): {
  requirementCodes: Set<string>;
  extraCodes: Set<string>;
} {
  const requirementCodes = new Set<string>();
  const extraCodes = new Set<string>();
  for (const skill of context.positionCatalog.skills) {
    if (context.version === 1 || skill.source !== 'questionnaire_extra') {
      requirementCodes.add(skill.code);
    } else {
      extraCodes.add(skill.code);
    }
  }
  return { requirementCodes, extraCodes };
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

/**
 * Pre-skillId V2 freezes (source + scale present, skillId omitted) need a one-time
 * catalog lookup by immutable skill `code` before strict parse.
 */
export function listV2SkillCodesMissingSkillId(raw: unknown): string[] {
  if (!isPlainObject(raw) || raw['version'] !== 2) return [];
  const pc = raw['positionCatalog'];
  if (!isPlainObject(pc) || !Array.isArray(pc['skills'])) return [];
  const codes: string[] = [];
  for (const item of pc['skills']) {
    if (!isPlainObject(item)) continue;
    if (typeof item['skillId'] === 'string') continue;
    if (typeof item['code'] === 'string') codes.push(item['code']);
  }
  return codes;
}

/**
 * Copy V2 context_json and set `skillId` on skills that lack it.
 * Does not invent ids — every missing code must exist in `skillIdByCode`.
 */
export function backfillV2ContextSkillIds(
  raw: unknown,
  skillIdByCode: ReadonlyMap<string, string>,
):
  | { ok: true; value: Record<string, unknown>; changed: boolean }
  | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return fail('context must be an object');
  }
  if (raw['version'] !== 2) {
    return { ok: true, value: raw, changed: false };
  }
  const pc = raw['positionCatalog'];
  if (!isPlainObject(pc) || !Array.isArray(pc['skills'])) {
    return fail('positionCatalog.skills missing or invalid');
  }

  let changed = false;
  const skills: unknown[] = [];
  for (let i = 0; i < pc['skills'].length; i += 1) {
    const item = pc['skills'][i];
    if (!isPlainObject(item)) {
      return fail(`positionCatalog.skills[${i}] must be an object`);
    }
    if (typeof item['skillId'] === 'string') {
      skills.push(item);
      continue;
    }
    const code = item['code'];
    if (typeof code !== 'string') {
      return fail(`positionCatalog.skills[${i}].code must be a string`);
    }
    const skillId = skillIdByCode.get(code);
    if (!skillId || !isUuidString(skillId)) {
      return fail(
        `positionCatalog.skills[${i}]: no catalog skillId for code ${code}`,
      );
    }
    skills.push({ ...item, skillId });
    changed = true;
  }

  if (!changed) {
    return { ok: true, value: raw, changed: false };
  }

  return {
    ok: true,
    changed: true,
    value: {
      ...raw,
      positionCatalog: {
        ...pc,
        skills,
      },
    },
  };
}
