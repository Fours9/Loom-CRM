import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type {
  CurrentUserResponse,
  LoginResponse,
} from '@loom/contracts-auth';
import { UsersService } from '../identity/users.service';
import { UserStatus } from '../identity/user.enums';
import { PermissionService } from '../permissions/permission.service';
import { AuthorizationContextService } from '../access-control/authorization-context.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from './jwt-payload.interface';
import { User } from '../identity/user.entity';
import { UserRole } from '../identity/user.enums';

/** Resolved by Organization when available; Platform stays decoupled via DI token. */
export abstract class EmployeeIdentityLookup {
  abstract findEmployeeIdByUserId(userId: string): Promise<string | null>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionService,
    private readonly audit: AuditService,
    private readonly employeeLookup: EmployeeIdentityLookup,
    private readonly authorization: AuthorizationContextService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.users.findByEmail(email);
    if (!user || user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    user.lastLoginAt = new Date();
    await this.users.save(user);

    await this.audit.record({
      action: 'auth.login',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
    });
    return this.issueSession(user);
  }

  async me(user: User): Promise<CurrentUserResponse> {
    const employeeId = await this.employeeLookup.findEmployeeIdByUserId(
      user.id,
    );
    return this.toCurrentUser(user, employeeId);
  }

  async changePassword(
    user: User,
    currentPassword: string,
    newPassword: string,
  ): Promise<LoginResponse> {
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new ForbiddenException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    user.tokenVersion += 1;
    await this.users.save(user);
    await this.audit.record({
      action: 'auth.password_changed',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
    });
    return this.issueSession(user);
  }

  /**
   * Admin sets a temporary password (PW parity).
   * Invalidates existing sessions via tokenVersion; user must change password on next login.
   */
  async resetPassword(
    actor: User,
    userId: string,
    temporaryPassword: string,
  ): Promise<{ message: string }> {
    const actorCtx = await this.authorization.resolve(actor.id);
    if (!actorCtx.isAdminEquivalent) {
      throw new ForbiddenException('Only admin can reset passwords');
    }

    const target = await this.users.getByIdOrFail(userId);
    target.passwordHash = await bcrypt.hash(temporaryPassword, 12);
    target.mustChangePassword = true;
    target.passwordChangedAt = new Date();
    target.tokenVersion = (target.tokenVersion ?? 0) + 1;
    await this.users.save(target);

    await this.audit.record({
      action: 'auth.password_reset',
      actorId: actor.id,
      entityType: 'user',
      entityId: target.id,
      metadata: { targetEmail: target.email },
    });

    return {
      message: 'Temporary password set; user must change it on next login',
    };
  }

  /** Single session issuance for login and post-change JWT. */
  private async issueSession(user: User): Promise<LoginResponse> {
    const employeeId = await this.employeeLookup.findEmployeeIdByUserId(
      user.id,
    );
    const accessToken = await this.signToken(user, employeeId);
    return {
      accessToken,
      user: await this.toCurrentUser(user, employeeId),
    };
  }

  private async signToken(
    user: User,
    employeeId: string | null,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      employeeId,
      tokenVersion: user.tokenVersion,
    };
    return this.jwt.signAsync(payload);
  }

  private async toCurrentUser(
    user: User,
    employeeId: string | null,
  ): Promise<CurrentUserResponse> {
    const context = await this.authorization.resolve(user.id);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: context.permissions as CurrentUserResponse['permissions'],
      surfaces: context.surfaces,
      accountRole: {
        id: context.accountRole.id,
        code: context.accountRole.code ?? context.accountRole.id,
        name: context.accountRole.name,
        isAdminEquivalent: context.accountRole.isAdminEquivalent,
      },
      employeeId,
      mustChangePassword: !!user.mustChangePassword,
    };
  }
}
