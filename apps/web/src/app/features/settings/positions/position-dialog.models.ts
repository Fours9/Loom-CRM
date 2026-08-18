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
 * Conflict drafts hide the matching persisted twin so the modal shows one row per skill.
 */
export function mergeRequirementRows(
  persisted: readonly PersistedRequirementLike[],
  drafts: readonly PendingSkillRequirement[],
): RequirementRowVm[] {
  const draftBySkill = new Map(drafts.map((d) => [d.skillId, d]));
  const hiddenSkillIds = new Set(
    drafts
      .filter((d) => d.state === 'conflict' || d.state === 'pending' || d.state === 'applying')
      .map((d) => d.skillId),
  );

  const rows: RequirementRowVm[] = [];
  for (const row of persisted) {
    const draft = draftBySkill.get(row.skillId);
    if (draft?.state === 'conflict') {
      rows.push(draftToRowVm(draft));
      continue;
    }
    if (hiddenSkillIds.has(row.skillId)) continue;
    rows.push(persistedToRowVm(row));
  }
  for (const draft of drafts) {
    if (draft.state === 'conflict') continue;
    if (persisted.some((row) => row.skillId === draft.skillId) && draft.state !== 'failed') {
      continue;
    }
    rows.push(draftToRowVm(draft));
  }
  return rows;
}

export function formatNativeTarget(row: {
  targetLevel: number;
  skillScaleKind?: 'range' | 'percent' | null;
  skillScaleMax?: number | null;
}): string {
  const kind = row.skillScaleKind ?? 'range';
  const max = row.skillScaleMax ?? 5;
  if (kind === 'percent') return `${row.targetLevel}%`;
  return `${row.targetLevel} / ${max}`;
}
