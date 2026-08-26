export type SkillSourceScale = {
  kind: 'range' | 'percent';
  min: number;
  max: number;
};

export type LiveSkillScale = {
  isActive: boolean;
  scaleKind: 'range' | 'percent' | string;
  scaleMin: number;
  scaleMax: number;
};

export type CanApplySkillAddResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'SKILL_MISSING' | 'SKILL_INACTIVE' | 'SKILL_SCALE_CHANGED';
    };

export function sameSkillScale(
  frozen: SkillSourceScale,
  live: Pick<LiveSkillScale, 'scaleKind' | 'scaleMin' | 'scaleMax'>,
): boolean {
  return (
    frozen.kind === live.scaleKind &&
    frozen.min === live.scaleMin &&
    frozen.max === live.scaleMax
  );
}

/**
 * Shared generation + Accept gate for Managing `add_skill` proposals.
 * - Missing / inactive skill → not ok
 * - Non-null proposedLevel requires frozen sourceScale === live Skill scale
 * - Null proposedLevel allows scale drift (add without score)
 */
export function canApplySkillAddProposal(input: {
  liveSkill: LiveSkillScale | null | undefined;
  proposedLevel: number | null;
  sourceScale: SkillSourceScale;
}): CanApplySkillAddResult {
  if (!input.liveSkill) {
    return { ok: false, reason: 'SKILL_MISSING' };
  }
  if (!input.liveSkill.isActive) {
    return { ok: false, reason: 'SKILL_INACTIVE' };
  }
  if (
    input.proposedLevel !== null &&
    !sameSkillScale(input.sourceScale, input.liveSkill)
  ) {
    return { ok: false, reason: 'SKILL_SCALE_CHANGED' };
  }
  return { ok: true };
}
