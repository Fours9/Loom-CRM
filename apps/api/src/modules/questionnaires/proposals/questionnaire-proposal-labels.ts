import type { QuestionnaireProposedChange } from '@loom/contracts-questionnaires';
import type { StoredQuestionnaireProposedChange } from './questionnaire-proposed-change';
import { CONTACTS_PROPOSAL_LABEL_UA } from './contacts-bundle-projector';

/**
 * Enrich stored change to wire DTO. field_update always gets labelUa.
 * Prefer frozen stored label → contacts map → schema field.label → fallback field key.
 */
export function enrichProposalChange(input: {
  stored: StoredQuestionnaireProposedChange;
  schemaFieldLabel?: string | null;
}): QuestionnaireProposedChange {
  const { stored } = input;
  if (stored.kind === 'add_skill') {
    return stored;
  }

  const contactsLabel =
    stored.section === 'contacts'
      ? CONTACTS_PROPOSAL_LABEL_UA[stored.field]
      : undefined;

  const labelUa =
    (typeof stored.labelUa === 'string' && stored.labelUa.trim()
      ? stored.labelUa.trim()
      : null) ??
    contactsLabel ??
    (input.schemaFieldLabel?.trim() || null) ??
    stored.field;

  return {
    kind: 'field_update',
    section: stored.section,
    field: stored.field,
    answerKey: stored.answerKey,
    from: stored.from,
    to: stored.to,
    labelUa,
  };
}
