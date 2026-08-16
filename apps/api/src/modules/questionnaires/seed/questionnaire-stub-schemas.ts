/**
 * Variant A published templates — employee-managing / employee-docs.
 * Schemas live in dedicated seed files (Track B).
 */
import { QUESTIONNAIRE_TYPE_CATALOG } from '@loom/contracts-questionnaires';
import { EMPLOYEE_DOCS_V1_SCHEMA } from './employee-docs-v1.schema';
import { EMPLOYEE_MANAGING_V1_SCHEMA } from './employee-managing-v1.schema';

export const EMPLOYEE_MANAGING_TEMPLATE_CODE = 'employee-managing';
export const EMPLOYEE_DOCS_TEMPLATE_CODE = 'employee-docs';

export const EMPLOYEE_MANAGING_TEMPLATE_TITLE =
  QUESTIONNAIRE_TYPE_CATALOG.managing.labelUa;
export const EMPLOYEE_DOCS_TEMPLATE_TITLE = QUESTIONNAIRE_TYPE_CATALOG.docs.labelUa;

export { EMPLOYEE_DOCS_V1_SCHEMA, EMPLOYEE_MANAGING_V1_SCHEMA };
