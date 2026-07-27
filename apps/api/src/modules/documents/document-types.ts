export const EMPLOYEE_DOCUMENT_TYPES = [
  'employment',
  'questionnaire',
  'identity',
  'education',
  'certificate',
  'medical',
  'consent',
  'other',
] as const;

export type EmployeeDocumentType = (typeof EMPLOYEE_DOCUMENT_TYPES)[number];

/** Types visible to department managers viewing someone else's profile. */
export const MANAGER_VISIBLE_DOCUMENT_TYPES = new Set<EmployeeDocumentType>([
  'employment',
  'education',
  'certificate',
  'other',
]);
