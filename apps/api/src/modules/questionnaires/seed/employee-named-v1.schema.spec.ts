import {
  EMPLOYEE_NAMED_TEMPLATE_CODE,
  EMPLOYEE_NAMED_V1_SCHEMA,
} from './employee-named-v1.schema';
import { EMPLOYEE_360_V1_SCHEMA } from './employee-360-v1.schema';
import { validateQuestionnaireSchema } from '@loom/questionnaire-schema';

describe('employee-named seed content', () => {
  it('validates and keeps compact product step order', () => {
    expect(EMPLOYEE_NAMED_V1_SCHEMA.code).toBe(EMPLOYEE_NAMED_TEMPLATE_CODE);
    expect(validateQuestionnaireSchema(EMPLOYEE_NAMED_V1_SCHEMA).ok).toBe(true);
    expect(EMPLOYEE_NAMED_V1_SCHEMA.steps.map((s) => s.key)).toEqual([
      'profile_mirror',
      'contacts',
      'experience',
      'company_work',
    ]);
  });

  it('reuses Full 360 profile_mirror fields', () => {
    const from360 = EMPLOYEE_360_V1_SCHEMA.steps.find(
      (s) => s.key === 'profile_mirror',
    );
    const fromNamed = EMPLOYEE_NAMED_V1_SCHEMA.steps.find(
      (s) => s.key === 'profile_mirror',
    );
    expect(fromNamed?.fields).toEqual(from360?.fields);
  });

  it('contacts reuse 360 field defs with personal label', () => {
    const from360 = EMPLOYEE_360_V1_SCHEMA.steps.find((s) => s.key === 'contacts');
    const fromNamed = EMPLOYEE_NAMED_V1_SCHEMA.steps.find(
      (s) => s.key === 'contacts',
    );
    expect(fromNamed?.label).toBe('Особисті контакти');
    expect(fromNamed?.fields).toEqual(from360?.fields);
  });

  it('experience is total_tenure only with named label', () => {
    const step = EMPLOYEE_NAMED_V1_SCHEMA.steps.find(
      (s) => s.key === 'experience',
    );
    expect(step?.fields.map((f) => f.key)).toEqual(['experience.total_tenure']);
    expect(step?.fields[0]?.label).toBe('Загальний досвід у сфері');
  });

  it('company_work is freestanding position only', () => {
    const step = EMPLOYEE_NAMED_V1_SCHEMA.steps.find(
      (s) => s.key === 'company_work',
    );
    expect(step?.fields).toHaveLength(1);
    const position = step?.fields[0] as {
      key: string;
      valueType: string;
      organizationEntity?: string;
      cascadeParentKey?: string;
      profileMirrorKey?: string;
    };
    expect(position.key).toBe('company_work.position_id');
    expect(position.valueType).toBe('organization_ref');
    expect(position.organizationEntity).toBe('position');
    expect(position.cascadeParentKey).toBeUndefined();
    expect(position.profileMirrorKey).toBe('positionId');
    expect(
      (position as { createsProfileProposal?: boolean }).createsProfileProposal,
    ).toBe(true);
    expect(
      (position as { proposalMapping?: { section: string; field: string } })
        .proposalMapping,
    ).toEqual({ section: 'employment', field: 'positionId' });
  });
});
