import {
  MANAGER_VISIBLE_DOCUMENT_TYPES,
  type EmployeeDocumentType,
} from './document-types';

export type DocumentTypeAccessInput = {
  isOwner: boolean;
  isAdminEquivalent: boolean;
  canViewTargetViaManagedScope: boolean;
  documentType: EmployeeDocumentType;
};

/**
 * Post-ADR 0011 type sensitivity: "manager" = managed employee scope,
 * not User.role === department_manager.
 */
export class DocumentTypeAccessPolicy {
  static canReadType(input: DocumentTypeAccessInput): boolean {
    if (input.isOwner || input.isAdminEquivalent) return true;
    if (input.canViewTargetViaManagedScope) {
      return MANAGER_VISIBLE_DOCUMENT_TYPES.has(input.documentType);
    }
    return false;
  }

  /** This slice: write ≡ read — cannot create a type you cannot access. */
  static canWriteType(input: DocumentTypeAccessInput): boolean {
    return DocumentTypeAccessPolicy.canReadType(input);
  }
}
