import type { QuestionnaireProfileProposalItem } from '@loom/contracts-questionnaires';

const NOT_SET = 'не вказано';

function isIsoDateLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return NOT_SET;
  }
  if (typeof value === 'string') {
    if (isIsoDateLike(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('uk-UA');
      }
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return NOT_SET;
}

function contactCountLabel(n: number): string {
  if (n === 1) return '1 контакт';
  if (n >= 2 && n <= 4) return `${n} контакти`;
  return `${n} контактів`;
}

function formatContactsValue(value: unknown): string {
  if (!Array.isArray(value)) {
    return formatScalar(value);
  }
  if (value.length === 0) return NOT_SET;
  return contactCountLabel(value.length);
}

/** Single entry for proposal titles shown in People / fill UI. */
export function proposalChangeTitle(
  p: QuestionnaireProfileProposalItem,
): string {
  const c = p.proposedChanges;
  switch (c.kind) {
    case 'add_skill':
      return c.labelUa || c.skillCode || p.targetSection;
    case 'field_update':
      return c.labelUa || c.field || p.targetSection;
    default:
      return p.targetSection;
  }
}

/** Human-readable from → to summary (never JSON.stringify of objects). */
export function proposalChangeSummary(
  p: QuestionnaireProfileProposalItem,
): string {
  const c = p.proposedChanges;
  switch (c.kind) {
    case 'add_skill': {
      const level =
        c.proposedLevel == null ? 'без оцінки' : String(c.proposedLevel);
      const verb =
        c.sourceAtSubmission === 'position_requirement'
          ? 'Підтвердити оцінку навички'
          : 'Додати навичку';
      return `${verb} · рівень: ${level}`;
    }
    case 'field_update': {
      if (
        c.field === 'personal_replace' ||
        c.field === 'emergency_replace' ||
        Array.isArray(c.from) ||
        Array.isArray(c.to)
      ) {
        return `${formatContactsValue(c.from)} → ${formatContactsValue(c.to)}`;
      }
      return `${formatScalar(c.from)} → ${formatScalar(c.to)}`;
    }
    default:
      return '';
  }
}

export function proposalCanAccept(p: QuestionnaireProfileProposalItem): boolean {
  return Boolean(p.capabilities?.canAccept);
}

export function proposalCanReject(p: QuestionnaireProfileProposalItem): boolean {
  return Boolean(p.capabilities?.canReject);
}
