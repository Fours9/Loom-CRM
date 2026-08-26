/**
 * employee-starter v1 — minimal preset: UI intro + review only (no schema steps yet).
 */

import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';

export const EMPLOYEE_STARTER_TEMPLATE_CODE = 'employee-starter';
export const EMPLOYEE_STARTER_TEMPLATE_TITLE = 'Стартова';
export const EMPLOYEE_STARTER_V1_SCHEMA_TITLE = 'Стартова анкета';

export const EMPLOYEE_STARTER_V1_SCHEMA = {
  code: EMPLOYEE_STARTER_TEMPLATE_CODE,
  version: 1,
  title: EMPLOYEE_STARTER_V1_SCHEMA_TITLE,
  steps: [],
} as const satisfies QuestionnaireSchemaJson;
