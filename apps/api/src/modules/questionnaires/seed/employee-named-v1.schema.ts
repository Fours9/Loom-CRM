/**
 * employee-named (Іменна) — compact name-badge form.
 * Reuses Full 360 profile_mirror + contacts field defs; experience =
 * total_tenure only; company_work = freestanding position_id only.
 * PDF: single-page coalesce + personal-contacts-only print (layout 2.6+).
 */

import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import { EMPLOYEE_360_V1_SCHEMA } from './employee-360-v1.schema';
import { buildCompanyWorkPositionOnlyFields } from './shared/company-work.fields';

export const EMPLOYEE_NAMED_TEMPLATE_CODE = 'employee-named';
export const EMPLOYEE_NAMED_TEMPLATE_TITLE = 'Іменна';
export const EMPLOYEE_NAMED_V1_SCHEMA_TITLE = 'Іменна анкета';

function stepFrom360(key: string) {
  const step = EMPLOYEE_360_V1_SCHEMA.steps.find((s) => s.key === key);
  if (!step) {
    throw new Error(`employee-360 seed missing step "${key}" for named`);
  }
  return step;
}

function totalTenureOnlyExperienceStep() {
  const experience = stepFrom360('experience');
  const totalTenure = experience.fields.find(
    (f) => f.key === 'experience.total_tenure',
  );
  if (!totalTenure) {
    throw new Error('employee-360 experience.total_tenure missing for named');
  }
  return {
    key: 'experience',
    label: 'Професійний досвід',
    fields: [
      {
        ...totalTenure,
        label: 'Загальний досвід у сфері',
      },
    ],
  };
}

export const EMPLOYEE_NAMED_V1_SCHEMA = {
  code: EMPLOYEE_NAMED_TEMPLATE_CODE,
  version: 1,
  title: EMPLOYEE_NAMED_V1_SCHEMA_TITLE,
  steps: [
    stepFrom360('profile_mirror'),
    {
      ...stepFrom360('contacts'),
      label: 'Особисті контакти',
    },
    totalTenureOnlyExperienceStep(),
    {
      key: 'company_work',
      label: 'Робота в компанії',
      fields: buildCompanyWorkPositionOnlyFields(),
    },
  ],
} satisfies QuestionnaireSchemaJson;
