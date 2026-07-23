import { Injectable } from '@nestjs/common';
import { Permission } from './permission.names';
import { UserRole } from '../identity/user.enums';
import { permissionsForRole } from './role-permissions';

@Injectable()
export class PermissionService {
  listForRole(role: UserRole): Permission[] {
    return permissionsForRole(role);
  }

  has(role: UserRole, permission: Permission): boolean {
    return permissionsForRole(role).includes(permission);
  }

  require(role: UserRole, permission: Permission): void {
    if (!this.has(role, permission)) {
      throw new Error(`Missing permission: ${permission}`);
    }
  }
}
