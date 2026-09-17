import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UserRole, UserStatus } from '../identity/user.enums';
import type { User } from '../identity/user.entity';
import type { UsersService } from '../identity/users.service';
import type { AuditService } from '../audit/audit.service';
import type { PermissionService } from '../permissions/permission.service';
import type { AuthorizationContextService } from '../access-control/authorization-context.service';
import type { JwtService } from '@nestjs/jwt';
import type { EmployeeIdentityLookup } from './auth.service';
import type { JwtPayload } from './jwt-payload.interface';

describe('AuthService session mapper and changePassword', () => {
  async function build(userOverrides?: Partial<User>) {
    const passwordHash = await bcrypt.hash('OldPass12', 4);
    const user = {
      id: 'u-1',
      email: 'user@example.com',
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: null,
      tokenVersion: 1,
      status: UserStatus.Active,
      role: UserRole.Employee,
      lastLoginAt: null,
      ...userOverrides,
    } as User;

    const users = {
      save: jest.fn(async (u: User) => u),
      findByEmail: jest.fn(async () => user),
    } as unknown as UsersService;

    const jwt = {
      signAsync: jest.fn(async (payload: JwtPayload) => JSON.stringify(payload)),
    } as unknown as JwtService;

    const permissions = {
      listForRole: jest.fn(() => ['employees.view']),
    } as unknown as PermissionService;

    const audit = {
      record: jest.fn(async () => ({})),
    } as unknown as AuditService;

    const employeeLookup = {
      findEmployeeIdByUserId: jest.fn(async () => 'emp-1'),
    } as unknown as EmployeeIdentityLookup;

    const authorization = {
      resolve: jest.fn(async (userId: string) => ({
        userId,
        accountRole: {
          id: 'role-employee',
          code: 'employee',
          name: 'Працівник',
          permissionPreset: 'employee' as const,
          isAdminEquivalent: false,
          isSystem: true,
        },
        permissions: ['employees.view'],
        surfaces: ['nav.home'],
        isAdminEquivalent: false,
        questionnaireTemplateCodes: [],
      })),
    } as unknown as AuthorizationContextService;

    const auth = new AuthService(
      users,
      jwt,
      permissions,
      audit,
      employeeLookup,
      authorization,
    );

    return { auth, user, users, jwt, audit };
  }

  it('toCurrentUser via me includes mustChangePassword', async () => {
    const { auth, user } = await build();
    const me = await auth.me(user);
    expect(me.mustChangePassword).toBe(true);
    expect(me.id).toBe(user.id);
    expect(me.employeeId).toBe('emp-1');
    expect(me.permissions).toEqual(['employees.view']);
  });

  it('changePassword returns a new JWT with bumped tokenVersion and flag false', async () => {
    const { auth, user, jwt, users } = await build();
    const result = await auth.changePassword(user, 'OldPass12', 'NewPass99');

    expect(user.mustChangePassword).toBe(false);
    expect(user.tokenVersion).toBe(2);
    expect(users.save).toHaveBeenCalledWith(user);
    expect(result.user.mustChangePassword).toBe(false);
    const payload = JSON.parse(result.accessToken) as JwtPayload;
    expect(payload.tokenVersion).toBe(2);
    expect(payload.mustChangePassword).toBe(false);
    expect(jwt.signAsync).toHaveBeenCalled();
  });

  it('rejects wrong current password without issuing a session', async () => {
    const { auth, user, jwt } = await build();
    await expect(
      auth.changePassword(user, 'wrong', 'NewPass99'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(user.tokenVersion).toBe(1);
  });
});
