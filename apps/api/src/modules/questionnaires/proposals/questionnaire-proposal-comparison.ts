import {
  parsePreferredLanguage,
  serializePreferredLanguage,
} from '@loom/questionnaire-schema';

export type ProposalChangeShape = {
  section?: string;
  field?: string;
  answerKey?: string;
  to?: unknown;
};

export type SchemaFieldForProposal = {
  key: string;
  options?: Array<{ value: string; label: string }>;
};

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'string' || typeof b === 'string') {
    return String(a).trim() === String(b).trim();
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compare proposal `to` against current profile value.
 * Language fields use shared parse/serialize with schema field options when present.
 */
export function proposalMatchesCurrentValue(input: {
  proposal: { proposedChanges: Record<string, unknown> | ProposalChangeShape };
  currentProfileValue: unknown;
  schemaField?: SchemaFieldForProposal | null;
}): boolean {
  const change = input.proposal.proposedChanges as ProposalChangeShape & {
    kind?: string;
  };
  if (change.kind === 'add_skill') return false;
  if (change.kind && change.kind !== 'field_update') return false;
  if (!change.section || !change.field) return false;

  let profileVal = input.currentProfileValue;
  if (change.answerKey === 'personal.preferred_language') {
    const opts = input.schemaField?.options ?? [
      { value: 'uk', label: 'Українська' },
      { value: 'en', label: 'Англійська' },
      { value: 'other', label: 'Інша' },
    ];
    const parsed = parsePreferredLanguage(profileVal, opts);
    profileVal = serializePreferredLanguage(
      parsed.selected,
      parsed.otherText,
      opts,
    );
  }
  return valuesEqual(profileVal, change.to);
}
