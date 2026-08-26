export type MatrixSkillSource =
  | 'position_requirement'
  | 'questionnaire_extra'
  | undefined;

export type MatrixClassifySkill = {
  code: string;
  source?: MatrixSkillSource;
};

/**
 * Managing matrix UI classification (position wins over desiredExtraCodes).
 * Legacy (available === null) is handled by the component labels, not here.
 */
export function classifyManagingMatrixSkills(input: {
  frozenSkills: MatrixClassifySkill[];
  desiredExtraCodes: string[];
}): { profileCodes: string[]; extraCodes: string[] } {
  const requirementCodes = new Set(
    input.frozenSkills
      .filter((s) => s.source === 'position_requirement')
      .map((s) => s.code),
  );
  const frozenCodes = new Set(input.frozenSkills.map((s) => s.code));

  const profileCodes: string[] = [];
  const extraCodes: string[] = [];

  for (const skill of input.frozenSkills) {
    if (skill.source === 'position_requirement') {
      profileCodes.push(skill.code);
    } else if (skill.source === 'questionnaire_extra') {
      extraCodes.push(skill.code);
    } else if (requirementCodes.has(skill.code)) {
      profileCodes.push(skill.code);
    } else {
      extraCodes.push(skill.code);
    }
  }

  for (const code of input.desiredExtraCodes) {
    if (!code) continue;
    if (requirementCodes.has(code)) continue;
    if (frozenCodes.has(code)) continue;
    if (extraCodes.includes(code)) continue;
    extraCodes.push(code);
  }

  return { profileCodes, extraCodes };
}
