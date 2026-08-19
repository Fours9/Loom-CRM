import {
  parseQuestionnaireContext,
  resolveAllowedSkillCodesFromContextJson,
} from '@loom/contracts-questionnaires';

const validSkill = {
  code: 'sewing',
  labelUa: 'Пошиття',
  group: 'TECH',
  targetLevel: 3,
  required: true,
  weight: null,
};

function validCatalog(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    employeeId: 'emp-1',
    employmentAssignmentId: null,
    positionId: 'pos-1',
    positionName: 'Tailor',
    departmentId: null,
    departmentName: null,
    directionId: null,
    directionName: null,
    capturedAt: '2026-01-01T00:00:00.000Z',
    skills: [],
    goalTemplates: [],
    duties: [],
    ...overrides,
  };
}

function validContext(
  catalogOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    version: 1,
    positionCatalog: validCatalog(catalogOverrides),
  };
}

describe('parseQuestionnaireContext (strict)', () => {
  it('accepts a full valid v1 context', () => {
    const parsed = parseQuestionnaireContext(
      validContext({ skills: [validSkill] }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.context.positionCatalog.skills[0]?.code).toBe('sewing');
    }
  });

  it('rejects unknown version', () => {
    const parsed = parseQuestionnaireContext({
      ...validContext(),
      version: 999,
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects empty positionCatalog object', () => {
    const parsed = parseQuestionnaireContext({
      version: 1,
      positionCatalog: {},
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects missing skills', () => {
    const catalog = validCatalog();
    delete catalog.skills;
    expect(parseQuestionnaireContext({ version: 1, positionCatalog: catalog }).ok).toBe(
      false,
    );
  });

  it('rejects skills as object', () => {
    expect(
      parseQuestionnaireContext(validContext({ skills: {} })).ok,
    ).toBe(false);
  });

  it('rejects skills item missing fields', () => {
    expect(
      parseQuestionnaireContext(validContext({ skills: [{}] })).ok,
    ).toBe(false);
  });

  it('rejects skills item with non-string code', () => {
    expect(
      parseQuestionnaireContext(
        validContext({ skills: [{ ...validSkill, code: 123 }] }),
      ).ok,
    ).toBe(false);
  });

  it('accepts old V1 skill rows without scale fields', () => {
    const parsed = parseQuestionnaireContext(
      validContext({ skills: [validSkill] }),
    );
    expect(parsed.ok).toBe(true);
  });

  it('rejects partial scale metadata', () => {
    expect(
      parseQuestionnaireContext(
        validContext({
          skills: [{ ...validSkill, scaleKind: 'percent' }],
        }),
      ).ok,
    ).toBe(false);
  });

  it('accepts empty frozen skill group (ungrouped capture)', () => {
    const parsed = parseQuestionnaireContext(
      validContext({ skills: [{ ...validSkill, group: '' }] }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.context.positionCatalog.skills[0]?.group).toBe('');
    }
  });

  it('accepts generated skill identity codes outside the registry', () => {
    const parsed = parseQuestionnaireContext(
      validContext({
        skills: [{ ...validSkill, code: 'skill_abc123def456' }],
      }),
    );
    expect(parsed.ok).toBe(true);
  });

  it('rejects targetLevel outside native scale bounds', () => {
    expect(
      parseQuestionnaireContext(
        validContext({
          skills: [
            {
              ...validSkill,
              targetLevel: 120,
              scaleKind: 'percent',
              scaleMin: 0,
              scaleMax: 100,
            },
          ],
        }),
      ).ok,
    ).toBe(false);
  });

  it('accepts all-or-none scale metadata', () => {
    const parsed = parseQuestionnaireContext(
      validContext({
        skills: [
          {
            ...validSkill,
            targetLevel: 80,
            scaleKind: 'percent',
            scaleMin: 0,
            scaleMax: 100,
          },
        ],
      }),
    );
    expect(parsed.ok).toBe(true);
  });

  it('rejects goalTemplates not array', () => {
    expect(
      parseQuestionnaireContext(validContext({ goalTemplates: {} })).ok,
    ).toBe(false);
  });

  it('rejects duties not array', () => {
    expect(
      parseQuestionnaireContext(validContext({ duties: {} })).ok,
    ).toBe(false);
  });

  it('rejects unknown root keys', () => {
    expect(
      parseQuestionnaireContext({ ...validContext(), extra: true }).ok,
    ).toBe(false);
  });
});

describe('resolveAllowedSkillCodesFromContextJson', () => {
  it('null → legacy (undefined allowlist)', () => {
    const r = resolveAllowedSkillCodesFromContextJson(null);
    expect(r).toEqual({ ok: true, allowedSkillCodes: undefined });
  });

  it('valid empty skills → empty allowlist (not legacy)', () => {
    const r = resolveAllowedSkillCodesFromContextJson(validContext({ skills: [] }));
    expect(r).toEqual({ ok: true, allowedSkillCodes: [] });
  });

  it('valid skills → codes only', () => {
    const r = resolveAllowedSkillCodesFromContextJson(
      validContext({ skills: [validSkill] }),
    );
    expect(r).toEqual({ ok: true, allowedSkillCodes: ['sewing'] });
  });

  it('invalid non-null → ok:false (not legacy)', () => {
    const r = resolveAllowedSkillCodesFromContextJson({
      version: 999,
      positionCatalog: {},
    });
    expect(r.ok).toBe(false);
  });
});
