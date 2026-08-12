/**
 * Variant A published stubs — assignable now; schemas intentionally minimal.
 * (Повна = employee-360; no separate general stub.)
 */
import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import { QUESTIONNAIRE_TYPE_CATALOG } from '@loom/contracts-questionnaires';

function stubSchema(
  code: string,
  title: string,
): QuestionnaireSchemaJson {
  return {
    code,
    version: 1,
    title,
    steps: [
      {
        key: 'placeholder',
        label: 'Чернетка',
        fields: [
          {
            key: 'stub.note',
            label: 'Примітка (тимчасово)',
            valueType: 'text',
            requiredPolicy: 'optional',
          },
        ],
      },
    ],
  };
}

export const EMPLOYEE_MANAGING_TEMPLATE_CODE = 'employee-managing';
export const EMPLOYEE_DOCS_TEMPLATE_CODE = 'employee-docs';

export const EMPLOYEE_MANAGING_TEMPLATE_TITLE =
  QUESTIONNAIRE_TYPE_CATALOG.managing.labelUa;
export const EMPLOYEE_DOCS_TEMPLATE_TITLE = QUESTIONNAIRE_TYPE_CATALOG.docs.labelUa;

export const EMPLOYEE_MANAGING_V1_SCHEMA = stubSchema(
  EMPLOYEE_MANAGING_TEMPLATE_CODE,
  EMPLOYEE_MANAGING_TEMPLATE_TITLE,
);
export const EMPLOYEE_DOCS_V1_SCHEMA = stubSchema(
  EMPLOYEE_DOCS_TEMPLATE_CODE,
  EMPLOYEE_DOCS_TEMPLATE_TITLE,
);
