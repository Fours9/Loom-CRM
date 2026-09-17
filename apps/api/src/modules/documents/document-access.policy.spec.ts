import { ConfidentialAccessPolicy } from '../../platform/access-control/confidential-access.policy';
import type { AuthorizationContext } from '../../platform/access-control/authorization-context';
import { Permission } from '../../platform/permissions/permission.names';
import { DocumentTypeAccessPolicy } from './document-type-access.policy';
import { DocumentResourceAccessPolicy } from './document-resource-access.policy';

describe('ConfidentialAccessPolicy', () => {
  const base = (
    over: Partial<AuthorizationContext> = {},
  ): AuthorizationContext =>
    ({
      userId: 'u1',
      accountRole: {
        id: 'r1',
        code: 'employee',
        name: 'Employee',
        permissionPreset: 'employee',
        isAdminEquivalent: false,
        isSystem: true,
      },
      permissions: [],
      surfaces: [],
      isAdminEquivalent: false,
      questionnaireTemplateCodes: [],
      ...over,
    }) as AuthorizationContext;

  it('owner can view without confidential.view; cannot mark', () => {
    const ctx = base();
    expect(ConfidentialAccessPolicy.canView(ctx, { isOwner: true })).toBe(true);
    expect(ConfidentialAccessPolicy.canMark(ctx)).toBe(false);
  });

  it('permission grants view and mark', () => {
    const ctx = base({ permissions: [Permission.ConfidentialView] });
    expect(ConfidentialAccessPolicy.canView(ctx, { isOwner: false })).toBe(
      true,
    );
    expect(ConfidentialAccessPolicy.canMark(ctx)).toBe(true);
  });

  it('adminEquivalent grants both', () => {
    const ctx = base({ isAdminEquivalent: true });
    expect(ConfidentialAccessPolicy.canView(ctx, { isOwner: false })).toBe(
      true,
    );
    expect(ConfidentialAccessPolicy.canMark(ctx)).toBe(true);
  });
});

describe('DocumentTypeAccessPolicy', () => {
  it('managed scope sees manager-visible types only', () => {
    expect(
      DocumentTypeAccessPolicy.canReadType({
        isOwner: false,
        isAdminEquivalent: false,
        canViewTargetViaManagedScope: true,
        documentType: 'employment',
      }),
    ).toBe(true);
    expect(
      DocumentTypeAccessPolicy.canWriteType({
        isOwner: false,
        isAdminEquivalent: false,
        canViewTargetViaManagedScope: true,
        documentType: 'medical',
      }),
    ).toBe(false);
  });

  it('owner and adminEquivalent see all types', () => {
    expect(
      DocumentTypeAccessPolicy.canReadType({
        isOwner: true,
        isAdminEquivalent: false,
        canViewTargetViaManagedScope: false,
        documentType: 'medical',
      }),
    ).toBe(true);
    expect(
      DocumentTypeAccessPolicy.canReadType({
        isOwner: false,
        isAdminEquivalent: true,
        canViewTargetViaManagedScope: false,
        documentType: 'identity',
      }),
    ).toBe(true);
  });
});

describe('DocumentResourceAccessPolicy', () => {
  const authz = {
    userId: 'u1',
    accountRole: {
      id: 'r1',
      code: 'employee',
      name: 'Employee',
      permissionPreset: 'employee',
      isAdminEquivalent: false,
      isSystem: true,
    },
    permissions: [] as AuthorizationContext['permissions'],
    surfaces: [],
    isAdminEquivalent: false,
  } as AuthorizationContext;

  it('denies when employee not in scope', () => {
    expect(
      DocumentResourceAccessPolicy.evaluateExistingDocumentAccess({
        authz,
        isOwner: false,
        employeeInScope: false,
        canViewTargetViaManagedScope: false,
        documentType: 'employment',
        isConfidential: false,
      }),
    ).toEqual({ canRead: false, canMutate: false });
  });

  it('owner reads confidential without mark permission; mutate allowed for type', () => {
    expect(
      DocumentResourceAccessPolicy.evaluateExistingDocumentAccess({
        authz,
        isOwner: true,
        employeeInScope: true,
        canViewTargetViaManagedScope: false,
        documentType: 'medical',
        isConfidential: true,
      }),
    ).toEqual({ canRead: true, canMutate: true });
  });

  it('confidential.view does not widen type gate', () => {
    const withConf = {
      ...authz,
      permissions: [Permission.ConfidentialView],
    } as AuthorizationContext;
    expect(
      DocumentResourceAccessPolicy.evaluateExistingDocumentAccess({
        authz: withConf,
        isOwner: false,
        employeeInScope: true,
        canViewTargetViaManagedScope: true,
        documentType: 'medical',
        isConfidential: false,
      }),
    ).toEqual({ canRead: false, canMutate: false });
  });
});
