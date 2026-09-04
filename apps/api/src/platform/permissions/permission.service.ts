import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { Permission } from './permission.names';
import { UserRole } from '../identity/user.enums';
import { permissionsForRole } from './role-permissions';
import { AuthorizationContextService } from '../access-control/authorization-context.service';

@Injectable()
export class PermissionService {
  constructor(
    /** Optional so unit tests can construct the legacy role-based surface. */
    @Optional()
    private readonly authorization?: AuthorizationContextService,
  ) {}

  /** Account-role permissions of a User — the authZ source of truth (ADR 0011). */
  async listForUser(userId: string): Promise<Permission[]> {
    const context = await this.requireAuthorization().resolve(userId);
    return context.permissions;
  }

  async hasForUser(userId: string, permission: Permission): Promise<boolean> {
    const context = await this.requireAuthorization().resolve(userId);
    return context.isAdminEquivalent || context.permissions.includes(permission);
  }

  async requireForUser(userId: string, permission: Permission): Promise<void> {
    if (!(await this.hasForUser(userId, permission))) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }

  /** @deprecated Reads the users.role mirror; prefer listForUser. */
  listForRole(role: UserRole): Permission[] {
    return permissionsForRole(role);
  }

  /** @deprecated Reads the users.role mirror; prefer hasForUser. */
  has(role: UserRole, permission: Permission): boolean {
    return permissionsForRole(role).includes(permission);
  }

  /** @deprecated Reads the users.role mirror; prefer requireForUser. */
  require(role: UserRole, permission: Permission): void {
    if (!this.has(role, permission)) {
      throw new Error(`Missing permission: ${permission}`);
    }
  }

  private requireAuthorization(): AuthorizationContextService {
    if (!this.authorization) {
      throw new Error('AuthorizationContextService is not available');
    }
    return this.authorization;
  }
}
