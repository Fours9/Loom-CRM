import { EMPLOYEE_360_V1_SCHEMA } from '../employee-360-v1.schema';
import { buildCompanyWorkFields } from './company-work.fields';
import { buildProfileMirrorIdentityFields } from './profile-mirror-identity.fields';

function stepFields(stepKey: string) {
  const step = EMPLOYEE_360_V1_SCHEMA.steps.find((s) => s.key === stepKey);
  if (!step) {
    throw new Error(`Missing employee-360 step: ${stepKey}`);
  }
  return step.fields;
}

describe('questionnaire seed shared factories', () => {
  it('profile_mirror full matches employee-360 step fields', () => {
    expect(buildProfileMirrorIdentityFields('full')).toEqual(
      stepFields('profile_mirror'),
    );
  });

  it('company_work full matches employee-360 step fields (regression)', () => {
    expect(buildCompanyWorkFields('full')).toEqual(stepFields('company_work'));
  });

  it('docsManagingPersonal omits preferred_name and includes birth/city', () => {
    const fields = buildProfileMirrorIdentityFields('docsManagingPersonal');
    const keys = fields.map((f) => f.key);
    expect(keys).toEqual([
      'personal.last_name',
      'personal.first_name',
      'personal.middle_name',
      'personal.birth_date',
      'personal.city',
    ]);
  });

  it('managing company_work uses organization_ref for org catalogs', () => {
    const fields = buildCompanyWorkFields('managing');
    const position = fields.find((f) => f.key === 'company_work.position_id');
    expect(position?.valueType).toBe('organization_ref');
    expect(position?.organizationEntity).toBe('position');
    expect(position?.profileMirrorKey).toBe('positionId');
  });
});
