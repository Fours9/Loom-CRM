import { valuesEqual } from './questionnaire-proposal-comparison';
import type { StoredQuestionnaireProposedChange } from './questionnaire-proposed-change';

export const COMPANY_WORK_DIRECTION_KEY = 'company_work.direction_id';
export const COMPANY_WORK_DEPARTMENT_KEY = 'company_work.department_id';
export const COMPANY_WORK_POSITION_KEY = 'company_work.position_id';

export type EmploymentOrgIds = {
  directionId: string | null;
  departmentId: string | null;
  positionId: string | null;
};

const ORG_FIELDS: Array<{
  answerKey: string;
  field: keyof EmploymentOrgIds;
  labelUa: string;
}> = [
  {
    answerKey: COMPANY_WORK_DIRECTION_KEY,
    field: 'directionId',
    labelUa: 'Напрямок',
  },
  {
    answerKey: COMPANY_WORK_DEPARTMENT_KEY,
    field: 'departmentId',
    labelUa: 'Підрозділ',
  },
  {
    answerKey: COMPANY_WORK_POSITION_KEY,
    field: 'positionId',
    labelUa: 'Посада',
  },
];

function asUuidOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

/** Read company_work org catalog ids from a submission / draft answers map. */
export function extractEmploymentOrgFromAnswers(
  answers: Record<string, unknown> | null | undefined,
): EmploymentOrgIds {
  const src = answers ?? {};
  return {
    directionId: asUuidOrNull(src[COMPANY_WORK_DIRECTION_KEY]),
    departmentId: asUuidOrNull(src[COMPANY_WORK_DEPARTMENT_KEY]),
    positionId: asUuidOrNull(src[COMPANY_WORK_POSITION_KEY]),
  };
}

export function employmentOrgHasAny(org: EmploymentOrgIds): boolean {
  return Boolean(org.directionId || org.departmentId || org.positionId);
}

export function employmentOrgEquals(
  a: EmploymentOrgIds,
  b: EmploymentOrgIds,
): boolean {
  return (
    valuesEqual(a.directionId, b.directionId) &&
    valuesEqual(a.departmentId, b.departmentId) &&
    valuesEqual(a.positionId, b.positionId)
  );
}

/**
 * Build field_update proposals for employment org when answers differ from
 * the current active assignment. Works even when frozen schemaJson omitted
 * createsProfileProposal (named / managing published before this fix).
 */
export function buildEmploymentOrgProposalCandidates(input: {
  answers: Record<string, unknown>;
  current: EmploymentOrgIds;
  schemaLabelByKey?: Map<string, string>;
}): Array<{
  targetSection: string;
  proposedChanges: StoredQuestionnaireProposedChange;
}> {
  const proposed = extractEmploymentOrgFromAnswers(input.answers);
  if (!employmentOrgHasAny(proposed)) return [];

  const candidates: Array<{
    targetSection: string;
    proposedChanges: StoredQuestionnaireProposedChange;
  }> = [];

  for (const row of ORG_FIELDS) {
    const to = proposed[row.field];
    if (to == null) continue;
    const from = input.current[row.field];
    if (valuesEqual(from, to)) continue;

    const schemaLabel = input.schemaLabelByKey?.get(row.answerKey)?.trim();
    candidates.push({
      targetSection: 'employment',
      proposedChanges: {
        kind: 'field_update',
        section: 'employment',
        field: row.field,
        answerKey: row.answerKey,
        from: from ?? null,
        to,
        labelUa: schemaLabel || row.labelUa,
      },
    });
  }

  return candidates;
}
