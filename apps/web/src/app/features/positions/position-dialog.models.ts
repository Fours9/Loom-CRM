export type PositionDialogMode =
  | 'create'
  | 'creating-position'
  | 'unresolved-create'
  | 'applying-drafts'
  | 'edit'
  | 'edit-with-failed-drafts';

export type DraftRequirementState = 'pending' | 'applying' | 'failed' | 'conflict';

export type PendingSkillRequirement = {
  clientId: string;
  sequence: number;
  skillId: string;
  targetLevel: number;
  required: boolean;
  state: DraftRequirementState;
  error?: string;
  persistedId?: string;
  skillName?: string | null;
  skillCode?: string | null;
  skillScaleKind?: 'range' | 'percent' | null;
  skillScaleMin?: number | null;
  skillScaleMax?: number | null;
};

export type RequirementRowVm =
  | {
      kind: 'draft';
      clientId: string;
      skillId: string;
      targetLevel: number;
      required: boolean;
      state: DraftRequirementState;
      error?: string;
      skillName?: string | null;
      skillCode?: string | null;
      skillScaleKind?: 'range' | 'percent' | null;
      skillScaleMin?: number | null;
      skillScaleMax?: number | null;
    }
  | {
      kind: 'persisted';
      id: string;
      skillId: string;
      targetLevel: number;
      required: boolean;
      skillName?: string | null;
      skillCode?: string | null;
      skillScaleKind?: 'range' | 'percent' | null;
      skillScaleMin?: number | null;
      skillScaleMax?: number | null;
    };

export type PersistedRequirementLike = {
  id: string;
  skillId: string;
  targetLevel: number;
  required: boolean;
  skillName?: string | null;
  skillCode?: string | null;
  skillScaleKind?: 'range' | 'percent' | null;
  skillScaleMin?: number | null;
  skillScaleMax?: number | null;
};

export type ClosePolicy =
  | { action: 'allow' }
  | { action: 'disabled' }
  | { action: 'confirm-discard-drafts' }
  | { action: 'acknowledge-unresolved' }
  | { action: 'warn-failed-drafts'; failedCount: number };

export function classifyPositionCreateError(
  err: unknown,
): 'known-rejection' | 'unknown' {
  const status = (err as { status?: number })?.status;
  if (status === 400 || status === 409) return 'known-rejection';
  return 'unknown';
}

export function isSaveLocked(mode: PositionDialogMode): boolean {
  return (
    mode === 'creating-position' ||
    mode === 'applying-drafts' ||
    mode === 'unresolved-create'
  );
}

export function canEditDraftQueue(mode: PositionDialogMode): boolean {
  return mode === 'create' || mode === 'edit' || mode === 'edit-with-failed-drafts';
}

export function closePolicyFor(
  mode: PositionDialogMode,
  draftCount: number,
  failedCount: number,
): ClosePolicy {
  if (mode === 'creating-position' || mode === 'applying-drafts') {
    return { action: 'disabled' };
  }
  if (mode === 'unresolved-create') {
    return { action: 'acknowledge-unresolved' };
  }
  if (mode === 'create' && draftCount > 0) {
    return { action: 'confirm-discard-drafts' };
  }
  if (mode === 'edit-with-failed-drafts' && failedCount > 0) {
    return { action: 'warn-failed-drafts', failedCount };
  }
  return { action: 'allow' };
}

export function draftToRowVm(row: PendingSkillRequirement): RequirementRowVm {
  return {
    kind: 'draft',
    clientId: row.clientId,
    skillId: row.skillId,
    targetLevel: row.targetLevel,
    required: row.required,
    state: row.state,
    error: row.error,
    skillName: row.skillName,
    skillCode: row.skillCode,
    skillScaleKind: row.skillScaleKind,
    skillScaleMin: row.skillScaleMin,
    skillScaleMax: row.skillScaleMax,
  };
}

export function persistedToRowVm(row: PersistedRequirementLike): RequirementRowVm {
  return {
    kind: 'persisted',
    id: row.id,
    skillId: row.skillId,
    targetLevel: row.targetLevel,
    required: row.required,
    skillName: row.skillName,
    skillCode: row.skillCode,
    skillScaleKind: row.skillScaleKind,
    skillScaleMin: row.skillScaleMin,
    skillScaleMax: row.skillScaleMax,
  };
}

/**
 * Merge server-backed rows with leftover draft/failed/conflict rows.
 * Invariant: at most one presentation row per skillId.
 * Unresolved draft wins over persisted, in order: conflict > failed > pending/applying > persisted.
 * Leftover drafts (no persisted twin) append in sequence ASC.
 */
export function mergeRequirementRows(
  persisted: readonly PersistedRequirementLike[],
  drafts: readonly PendingSkillRequirement[],
): RequirementRowVm[] {
  const bestDraftBySkill = new Map<string, PendingSkillRequirement>();
  for (const draft of drafts) {
    const prev = bestDraftBySkill.get(draft.skillId);
    if (!prev || unresolvedDraftRank(draft.state) > unresolvedDraftRank(prev.state)) {
      bestDraftBySkill.set(draft.skillId, draft);
    }
  }

  const usedSkills = new Set<string>();
  const rows: RequirementRowVm[] = [];
  for (const row of persisted) {
    const draft = bestDraftBySkill.get(row.skillId);
    if (draft && unresolvedDraftRank(draft.state) > 0) {
      rows.push(draftToRowVm(draft));
    } else {
      rows.push(persistedToRowVm(row));
    }
    usedSkills.add(row.skillId);
  }

  const leftovers = [...bestDraftBySkill.values()]
    .filter((draft) => !usedSkills.has(draft.skillId))
    .sort((a, b) => a.sequence - b.sequence);
  for (const draft of leftovers) {
    rows.push(draftToRowVm(draft));
  }
  return rows;
}

function unresolvedDraftRank(state: DraftRequirementState): number {
  if (state === 'conflict') return 4;
  if (state === 'failed') return 3;
  if (state === 'pending' || state === 'applying') return 2;
  return 0;
}

export function httpErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { error?: { message?: string | string[] } })?.error?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}

export function compareByUkNameThenId(
  a: { name: string; id: string },
  b: { name: string; id: string },
  sign: number,
): number {
  const byName = a.name.localeCompare(b.name, 'uk');
  if (byName !== 0) return byName * sign;
  return a.id.localeCompare(b.id);
}

export type PositionSaveCompletion = 'close-and-reset' | 'keep-open-with-queue';

/** Close after PATCH only when the draft queue is empty (precondition for closeAfterSuccessfulSave). */
export function positionSaveCompletion(input: {
  queueEmpty: boolean;
  hasUnresolved: boolean;
}): PositionSaveCompletion {
  if (input.hasUnresolved || !input.queueEmpty) return 'keep-open-with-queue';
  return 'close-and-reset';
}

export function filterDepartmentsByDirection<
  T extends { id: string; directionId: string | null },
>(departments: T[], directionId: string): T[] {
  if (!directionId) return departments;
  return departments.filter((d) => d.directionId === directionId);
}

export function departmentFitsSelectedDirection(
  department: { directionId: string | null } | undefined,
  directionId: string,
): boolean {
  if (!directionId) return true;
  return department?.directionId === directionId;
}

export function formatNativeTarget(row: {
  targetLevel?: number;
  skillScaleKind?: 'range' | 'percent' | null;
  skillScaleMin?: number | null;
  skillScaleMax?: number | null;
}): string {
  const kind = row.skillScaleKind ?? 'range';
  const min = row.skillScaleMin ?? 0;
  const max = row.skillScaleMax ?? 5;
  if (kind === 'percent') return `${min}–${max}%`;
  return `${min}–${max}`;
}
