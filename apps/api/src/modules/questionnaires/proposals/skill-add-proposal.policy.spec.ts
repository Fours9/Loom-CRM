import {
  canApplySkillAddProposal,
  sameSkillScale,
} from './skill-add-proposal.policy';

describe('sameSkillScale', () => {
  it('matches kind+min+max', () => {
    expect(
      sameSkillScale(
        { kind: 'percent', min: 0, max: 100 },
        { scaleKind: 'percent', scaleMin: 0, scaleMax: 100 },
      ),
    ).toBe(true);
    expect(
      sameSkillScale(
        { kind: 'percent', min: 0, max: 100 },
        { scaleKind: 'range', scaleMin: 0, scaleMax: 100 },
      ),
    ).toBe(false);
  });
});

describe('canApplySkillAddProposal', () => {
  const sourceScale = { kind: 'percent' as const, min: 0, max: 100 };
  const live = {
    isActive: true,
    scaleKind: 'percent' as const,
    scaleMin: 0,
    scaleMax: 100,
  };

  it('rejects missing skill', () => {
    expect(
      canApplySkillAddProposal({
        liveSkill: null,
        proposedLevel: 80,
        sourceScale,
      }),
    ).toEqual({ ok: false, reason: 'SKILL_MISSING' });
  });

  it('rejects inactive skill', () => {
    expect(
      canApplySkillAddProposal({
        liveSkill: { ...live, isActive: false },
        proposedLevel: null,
        sourceScale,
      }),
    ).toEqual({ ok: false, reason: 'SKILL_INACTIVE' });
  });

  it('rejects rated proposal when scale drifted', () => {
    expect(
      canApplySkillAddProposal({
        liveSkill: { ...live, scaleKind: 'range' },
        proposedLevel: 80,
        sourceScale,
      }),
    ).toEqual({ ok: false, reason: 'SKILL_SCALE_CHANGED' });
  });

  it('allows unrated proposal when scale drifted', () => {
    expect(
      canApplySkillAddProposal({
        liveSkill: { ...live, scaleKind: 'range' },
        proposedLevel: null,
        sourceScale,
      }),
    ).toEqual({ ok: true });
  });

  it('allows rated proposal when scales match', () => {
    expect(
      canApplySkillAddProposal({
        liveSkill: live,
        proposedLevel: 80,
        sourceScale,
      }),
    ).toEqual({ ok: true });
  });
});
