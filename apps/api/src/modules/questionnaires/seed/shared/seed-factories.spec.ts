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

  it('company_work matches employee-360 step fields', () => {
    expect(buildCompanyWorkFields()).toEqual(stepFields('company_work'));
  });
});
