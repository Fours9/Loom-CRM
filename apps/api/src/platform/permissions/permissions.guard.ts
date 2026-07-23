import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from './permission.names';
import { User } from '../identity/user.entity';
import { permissionsForRole } from './role-permissions';
import { PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }
    const granted = new Set(permissionsForRole(user.role));
    const ok = required.every((p) => granted.has(p));
    if (!ok) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
