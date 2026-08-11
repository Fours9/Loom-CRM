import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole, UserStatus } from '../identity/user.enums';
import type { User } from '../identity/user.entity';
import type { UsersService } from '../identity/users.service';
import type { AuditService } from '../audit/audit.service';
import type { PermissionService } from '../permissions/permission.service';
import type { JwtService } from '@nestjs/jwt';
import type { EmployeeIdentityLookup } from './auth.service';

describe('AuthService.resetPassword', () => {
  function build(overrides?: {
    actorRole?: UserRole;
    target?: User | null;
  }) {
    const target =
      overrides && 'target' in overrides
        ? overrides.target
        : ({
            id: 'u-target',
            email: 'user@example.com',
            passwordHash: 'old',
            mustChangePassword: false,
            passwordChangedAt: null,
            tokenVersion: 3,
            status: UserStatus.Active,
            role: UserRole.Employee,
          } as User);

    const users = {
      getByIdOrFail: jest.fn(async (id: string) => {
        if (!target || target.id !== id) {
          throw new NotFoundException('User not found');
        }
        return target;
      }),
      save: jest.fn(async (u: User) => u),
    } as unknown as UsersService;

    const audit = {
      record: jest.fn(async () => ({})),
    } as unknown as AuditService;

    const auth = new AuthService(
      users,
      {} as JwtService,
      {} as PermissionService,
      audit,
      {} as EmployeeIdentityLookup,
    );

    const actor = {
      id: 'u-admin',
      role: overrides?.actorRole ?? UserRole.Admin,
    } as User;

    return { auth, users, audit, actor, target };
  }

  it('rejects non-admin actors', async () => {
    const { auth, actor } = build({ actorRole: UserRole.Employee });
    await expect(
      auth.resetPassword(actor, 'u-target', 'TempPass12'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sets temporary password, forces change, bumps tokenVersion, audits', async () => {
    const { auth, users, audit, actor, target } = build();
    if (!target) throw new Error('expected target');

    const result = await auth.resetPassword(actor, target.id, 'TempPass12');

    expect(result.message).toMatch(/Temporary password set/);
    expect(target.mustChangePassword).toBe(true);
    expect(target.tokenVersion).toBe(4);
    expect(target.passwordHash).not.toBe('old');
    expect(users.save).toHaveBeenCalledWith(target);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.password_reset',
        actorId: actor.id,
        entityType: 'user',
        entityId: target.id,
        metadata: { targetEmail: target.email },
      }),
    );
  });
});
