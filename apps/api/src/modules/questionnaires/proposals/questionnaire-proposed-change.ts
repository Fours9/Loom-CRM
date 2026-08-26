import type { QuestionnaireProposedChange } from '@loom/contracts-questionnaires';

export class InvalidProposedChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProposedChangeError';
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Fail-closed runtime parse after migration backfill.
 * Missing / unknown `kind` → integrity failure (no legacy branch).
 */
export function parseQuestionnaireProposedChange(
  raw: unknown,
): QuestionnaireProposedChange {
  if (!isPlainObject(raw)) {
    throw new InvalidProposedChangeError('proposedChanges must be an object');
  }
  const kind = raw['kind'];
  if (kind === 'field_update') {
    if (typeof raw['section'] !== 'string') {
      throw new InvalidProposedChangeError('field_update.section required');
    }
    if (typeof raw['field'] !== 'string') {
      throw new InvalidProposedChangeError('field_update.field required');
    }
    if (typeof raw['answerKey'] !== 'string') {
      throw new InvalidProposedChangeError('field_update.answerKey required');
    }
    if (!Object.prototype.hasOwnProperty.call(raw, 'from')) {
      throw new InvalidProposedChangeError('field_update.from required');
    }
    if (!Object.prototype.hasOwnProperty.call(raw, 'to')) {
      throw new InvalidProposedChangeError('field_update.to required');
    }
    return {
      kind: 'field_update',
      section: raw['section'],
      field: raw['field'],
      answerKey: raw['answerKey'],
      from: raw['from'],
      to: raw['to'],
    };
  }
  if (kind === 'add_skill') {
    if (raw['section'] !== 'skills') {
      throw new InvalidProposedChangeError('add_skill.section must be skills');
    }
    if (typeof raw['field'] !== 'string' || !raw['field']) {
      throw new InvalidProposedChangeError('add_skill.field required');
    }
    if (typeof raw['skillId'] !== 'string' || !raw['skillId']) {
      throw new InvalidProposedChangeError('add_skill.skillId required');
    }
    if (typeof raw['skillCode'] !== 'string' || !raw['skillCode']) {
      throw new InvalidProposedChangeError('add_skill.skillCode required');
    }
    if (typeof raw['labelUa'] !== 'string') {
      throw new InvalidProposedChangeError('add_skill.labelUa required');
    }
    const proposedLevel = raw['proposedLevel'];
    if (
      proposedLevel !== null &&
      (typeof proposedLevel !== 'number' || !Number.isInteger(proposedLevel))
    ) {
      throw new InvalidProposedChangeError(
        'add_skill.proposedLevel must be integer or null',
      );
    }
    const sourceScale = raw['sourceScale'];
    if (!isPlainObject(sourceScale)) {
      throw new InvalidProposedChangeError('add_skill.sourceScale required');
    }
    const scaleKind = sourceScale['kind'];
    if (scaleKind !== 'range' && scaleKind !== 'percent') {
      throw new InvalidProposedChangeError(
        'add_skill.sourceScale.kind must be range or percent',
      );
    }
    const min = sourceScale['min'];
    const max = sourceScale['max'];
    if (typeof min !== 'number' || !Number.isInteger(min)) {
      throw new InvalidProposedChangeError(
        'add_skill.sourceScale.min must be an integer',
      );
    }
    if (typeof max !== 'number' || !Number.isInteger(max)) {
      throw new InvalidProposedChangeError(
        'add_skill.sourceScale.max must be an integer',
      );
    }
    const rawSource = raw['sourceAtSubmission'];
    let sourceAtSubmission:
      | 'position_requirement'
      | 'questionnaire_extra'
      | undefined;
    if (rawSource !== undefined && rawSource !== null) {
      if (
        rawSource !== 'position_requirement' &&
        rawSource !== 'questionnaire_extra'
      ) {
        throw new InvalidProposedChangeError(
          'add_skill.sourceAtSubmission must be position_requirement or questionnaire_extra',
        );
      }
      sourceAtSubmission = rawSource;
    }
    return {
      kind: 'add_skill',
      section: 'skills',
      field: raw['field'],
      skillId: raw['skillId'],
      skillCode: raw['skillCode'],
      labelUa: raw['labelUa'],
      proposedLevel,
      sourceScale: { kind: scaleKind, min, max },
      ...(sourceAtSubmission ? { sourceAtSubmission } : {}),
    };
  }
  throw new InvalidProposedChangeError(
    `proposedChanges.kind missing or unknown: ${String(kind)}`,
  );
}
