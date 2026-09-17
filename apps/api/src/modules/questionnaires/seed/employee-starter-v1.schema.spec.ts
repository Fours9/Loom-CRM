import {
  EMPLOYEE_STARTER_TEMPLATE_CODE,
  EMPLOYEE_STARTER_V1_SCHEMA,
} from './employee-starter-v1.schema';
import { EMPLOYEE_360_V1_SCHEMA } from './employee-360-v1.schema';

describe('employee-starter seed content', () => {
  it('includes the six primary content steps in product order', () => {
    expect(EMPLOYEE_STARTER_V1_SCHEMA.code).toBe(EMPLOYEE_STARTER_TEMPLATE_CODE);
    expect(EMPLOYEE_STARTER_V1_SCHEMA.steps.map((s) => s.key)).toEqual([
      'profile_mirror',
      'contacts',
      'family',
      'education',
      'experience',
      'company_work',
    ]);
  });

  it('reuses Full 360 field defs for shared personal steps', () => {
    for (const key of [
      'profile_mirror',
      'contacts',
      'family',
      'education',
      'experience',
    ] as const) {
      const from360 = EMPLOYEE_360_V1_SCHEMA.steps.find((s) => s.key === key);
      const fromStarter = EMPLOYEE_STARTER_V1_SCHEMA.steps.find(
        (s) => s.key === key,
      );
      expect(fromStarter?.fields).toEqual(from360?.fields);
      expect(fromStarter?.label).toBe(from360?.label);
    }
  });

  it('company_work label matches Managing', () => {
    const step = EMPLOYEE_STARTER_V1_SCHEMA.steps.find(
      (s) => s.key === 'company_work',
    );
    expect(step?.label).toBe('Робота в компанії');
    expect(
      step?.fields.some((f) => f.key === 'company_work.direction_id'),
    ).toBe(true);
  });
});
