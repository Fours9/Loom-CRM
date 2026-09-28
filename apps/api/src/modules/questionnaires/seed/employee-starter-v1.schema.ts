/**
 * employee-starter (Первинна) — subset of Full 360 + Managing company_work + consents.
 * Steps reused from employee-360 / shared factories so field SoT stays single.
 */

import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import { EMPLOYEE_360_V1_SCHEMA } from './employee-360-v1.schema';
import { buildCompanyWorkFields } from './shared/company-work.fields';

export const EMPLOYEE_STARTER_TEMPLATE_CODE = 'employee-starter';
export const EMPLOYEE_STARTER_TEMPLATE_TITLE = 'Первинна';
export const EMPLOYEE_STARTER_V1_SCHEMA_TITLE = 'Первинна анкета';

function stepFrom360(key: string) {
  const step = EMPLOYEE_360_V1_SCHEMA.steps.find((s) => s.key === key);
  if (!step) {
    throw new Error(`employee-360 seed missing step "${key}" for starter`);
  }
  return step;
}

export const EMPLOYEE_STARTER_V1_SCHEMA = {
  code: EMPLOYEE_STARTER_TEMPLATE_CODE,
  version: 1,
  title: EMPLOYEE_STARTER_V1_SCHEMA_TITLE,
  steps: [
    stepFrom360('profile_mirror'),
    stepFrom360('contacts'),
    stepFrom360('family'),
    stepFrom360('education'),
    stepFrom360('experience'),
    {
      key: 'company_work',
      label: 'Робота в компанії',
      fields: buildCompanyWorkFields('managing'),
    },
    stepFrom360('consents_review'),
  ],
} satisfies QuestionnaireSchemaJson;
