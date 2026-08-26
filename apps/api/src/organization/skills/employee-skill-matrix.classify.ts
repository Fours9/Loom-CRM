/**
 * Pure classification for People skill matrix buckets.
 * Profile membership = all position_skill_requirements (required is metadata only).
 * Extras = confirmed assessments whose skillId is not in current requirements.
 * No current position → profile empty, all confirmed → extras.
 */
export function classifyEmployeeSkillMatrixBuckets(input: {
  requirementSkillIds: readonly string[];
  confirmedSkillIds: readonly string[];
}): {
  profileSkillIds: string[];
  extraSkillIds: string[];
} {
  const requirementIds = new Set(input.requirementSkillIds);
  return {
    profileSkillIds: [...input.requirementSkillIds],
    extraSkillIds: input.confirmedSkillIds.filter((id) => !requirementIds.has(id)),
  };
}
