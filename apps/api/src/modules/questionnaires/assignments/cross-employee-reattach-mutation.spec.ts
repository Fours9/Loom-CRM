import {
  reconcileSkillsMatrixForNewContext,
  SKILLS_MATRIX_ANSWER_KEY,
} from './reconcile-skills-matrix-for-new-context';
import { resolveCrossEmployeeReattachMutation } from './cross-employee-reattach-mutation';

describe('reconcileSkillsMatrixForNewContext', () => {
  it('drops stale rating codes and keeps custom', () => {
    const result = reconcileSkillsMatrixForNewContext({
      matrix: {
        ratings: [
          { skillCode: 'overlock', level: 4 },
          { skillCode: 'crm', level: 2 },
        ],
        custom: [{ name: 'x', level: 1 }],
      },
      targetContextSkills: new Set(['crm', 'sales']),
    });
    expect(result.removedStaleSkillCodes).toEqual(['overlock']);
    expect(result.matrix?.ratings.map((r) => r.skillCode)).toEqual(['crm']);
    expect(result.matrix?.custom).toEqual([
      { name: 'x', level: 1, comment: null },
    ]);
  });

  it('returns undefined matrix when input null', () => {
    const result = reconcileSkillsMatrixForNewContext({
      matrix: null,
      targetContextSkills: new Set(['crm']),
    });
    expect(result.matrix).toBeUndefined();
    expect(result.removedStaleSkillCodes).toEqual([]);
  });
});

describe('resolveCrossEmployeeReattachMutation', () => {
  const nextContext = {
    version: 2,
    positionCatalog: {
      employeeId: 'emp-2',
      employmentAssignmentId: null,
      positionId: 'pos-b',
      positionName: 'B',
      departmentId: 'dep-b',
      departmentName: 'Dept B',
      directionId: 'dir-b',
      directionName: 'Dir B',
      capturedAt: '2026-01-01T00:00:00.000Z',
      skills: [
        {
          skillId: '11111111-1111-4111-8111-111111111111',
          code: 'crm',
          labelUa: 'CRM',
          group: '',
          targetLevel: 3,
          required: true,
          weight: null,
          scaleKind: 'range',
          scaleMin: 0,
          scaleMax: 5,
          source: 'position_requirement',
        },
      ],
      goalTemplates: [],
      duties: [],
    },
  };

  it('preserves portable personal name and overwrites org allowlist', () => {
    const mutation = resolveCrossEmployeeReattachMutation({
      answersJson: {
        'personal.first_name': 'Дмитро',
        'personal.last_name': 'Кіліян',
        'company_work.direction_id': 'dir-a',
        'company_work.department_id': 'dep-a',
        'company_work.position_id': 'pos-a',
        [SKILLS_MATRIX_ANSWER_KEY]: {
          ratings: [{ skillCode: 'overlock', level: 4 }],
          custom: [],
        },
      },
      nextContext,
    });

    expect(mutation.nextAnswers['personal.first_name']).toBe('Дмитро');
    expect(mutation.nextAnswers['company_work.position_id']).toBe('pos-b');
    expect(mutation.nextAnswers['company_work.department_id']).toBe('dep-b');
    expect(mutation.nextAnswers['company_work.direction_id']).toBe('dir-b');
    expect(mutation.removedStaleSkillCodes).toContain('overlock');
    expect(mutation.bumpRevision).toBe(true);
    expect(mutation.resetLifecycle).toBe(true);
  });
});
