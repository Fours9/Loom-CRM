import {
  SKILL_DEFINITIONS,
  SKILL_GROUP_CODES,
  isSkillCode,
  skillDefinitionByCode,
  skillsForGroup,
} from './skill-definitions';

describe('position-skill-catalog', () => {
  it('has unique codes', () => {
    const codes = SKILL_DEFINITIONS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('covers all groups', () => {
    for (const g of SKILL_GROUP_CODES) {
      expect(skillsForGroup(g).length).toBeGreaterThan(0);
    }
  });

  it('isSkillCode accepts registry codes only', () => {
    expect(isSkillCode('sewing')).toBe(true);
    expect(isSkillCode('excel')).toBe(false);
    expect(isSkillCode(null)).toBe(false);
  });

  it('skillDefinitionByCode returns label', () => {
    expect(skillDefinitionByCode('packing')?.labelUa).toContain('пакуван');
  });
});
