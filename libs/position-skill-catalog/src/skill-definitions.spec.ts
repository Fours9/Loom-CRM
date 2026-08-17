import {
  SKILL_DEFINITIONS,
  SKILL_GROUP_CODES,
  isSkillCode,
  isSkillIdentityCode,
  skillDefinitionByCode,
  skillsForGroup,
  validateSkillScaleBounds,
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
    expect(isSkillCode('skill_abc123')).toBe(false);
  });

  it('isSkillIdentityCode accepts syntax not registry membership', () => {
    expect(isSkillIdentityCode('sewing')).toBe(true);
    expect(isSkillIdentityCode('skill_abc123')).toBe(true);
    expect(isSkillIdentityCode('sewwing')).toBe(true);
    expect(isSkillIdentityCode('Skill_X')).toBe(false);
    expect(isSkillIdentityCode('a'.repeat(65))).toBe(false);
  });

  it('skillDefinitionByCode returns label', () => {
    expect(skillDefinitionByCode('packing')?.labelUa).toContain('пакуван');
  });

  it('validateSkillScaleBounds allows negative range', () => {
    expect(validateSkillScaleBounds('range', -10, -1).ok).toBe(true);
    expect(validateSkillScaleBounds('percent', 0, 100).ok).toBe(true);
    expect(validateSkillScaleBounds('percent', -1, 50).ok).toBe(false);
  });
});
