import type { EntityId } from '@loom/contracts-common';

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

export type EmployeeDocumentFileItem = {
  id: EntityId;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
};

export type EmployeeDocumentListItem = {
  source: 'employee_document';
  id: EntityId;
  employeeId: EntityId;
  documentType: EmployeeDocumentType;
  title: string;
  createdAt: string;
  relatedStartDate: null;
  relatedEndDate: null;
  /** Single file; id equals the parent document id. */
  files: [EmployeeDocumentFileItem];
  permissions: {
    canDelete: boolean;
  };
};

export type EmployeeDocumentListResponse = {
  items: EmployeeDocumentListItem[];
  capabilities: {
    canUpload: boolean;
  };
};

export type UploadEmployeeDocumentResponse = EmployeeDocumentListItem;
