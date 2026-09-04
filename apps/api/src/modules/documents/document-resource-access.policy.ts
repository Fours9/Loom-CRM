import { NotFoundException } from '@nestjs/common';
import { ConfidentialAccessPolicy } from '../../platform/access-control/confidential-access.policy';
import type { AuthorizationContext } from '../../platform/access-control/authorization-context';
import type { EmployeeDocumentType } from './document-types';
import { DocumentTypeAccessPolicy } from './document-type-access.policy';

export type ExistingDocumentAccessInput = {
  authz: AuthorizationContext;
  isOwner: boolean;
  employeeInScope: boolean;
  canViewTargetViaManagedScope: boolean;
  documentType: EmployeeDocumentType;
  isConfidential: boolean;
};

export type ExistingDocumentAccessDecision = {
  canRead: boolean;
  canMutate: boolean;
};

/**
 * Single reusable decision for list / download / softDelete (and future metadata PATCH).
 * Stacks type gate + confidential gate; defense-in-depth on employeeInScope.
 */
export class DocumentResourceAccessPolicy {
  static evaluateExistingDocumentAccess(
    input: ExistingDocumentAccessInput,
  ): ExistingDocumentAccessDecision {
    if (!input.employeeInScope) {
      return { canRead: false, canMutate: false };
    }

    const typeOk = DocumentTypeAccessPolicy.canReadType({
      isOwner: input.isOwner,
      isAdminEquivalent: input.authz.isAdminEquivalent,
      canViewTargetViaManagedScope: input.canViewTargetViaManagedScope,
      documentType: input.documentType,
    });
    const confOk =
      !input.isConfidential ||
      ConfidentialAccessPolicy.canView(input.authz, {
        isOwner: input.isOwner,
      });
    const allowed = typeOk && confOk;
    return { canRead: allowed, canMutate: allowed };
  }

  /** Shared concealment for softDelete / future mutations. */
  static requireExistingDocumentMutationAccess(
    input: ExistingDocumentAccessInput,
  ): void {
    const decision =
      DocumentResourceAccessPolicy.evaluateExistingDocumentAccess(input);
    if (!decision.canMutate) {
      throw new NotFoundException('Document not found');
    }
  }

  static requireExistingDocumentReadAccess(
    input: ExistingDocumentAccessInput,
  ): void {
    const decision =
      DocumentResourceAccessPolicy.evaluateExistingDocumentAccess(input);
    if (!decision.canRead) {
      throw new NotFoundException('Document not found');
    }
  }
}
