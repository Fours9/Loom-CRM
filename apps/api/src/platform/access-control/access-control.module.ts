import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../identity/user.entity';
import { AccountRole } from './account-role.entity';
import { AccountRolePermission } from './account-role-permission.entity';
import { AccountRoleSurface } from './account-role-surface.entity';
import { AppSurface } from './app-surface.entity';
import { AuthorizationContextService } from './authorization-context.service';
import { AccountRolesService } from './account-roles.service';
import { AccountRolesController } from './account-roles.controller';
import { LastAdminPolicy } from './last-admin.policy';

/**
 * Platform AccessControl owns account roles, surfaces and the authZ context.
 * Platform must never depend on Organization — nothing here imports it.
 * ConfidentialAccessPolicy is a pure static helper (imported directly).
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountRole,
      AccountRoleSurface,
      AccountRolePermission,
      AppSurface,
      User,
    ]),
  ],
  providers: [AuthorizationContextService, AccountRolesService, LastAdminPolicy],
  controllers: [AccountRolesController],
  exports: [
    AuthorizationContextService,
    AccountRolesService,
    LastAdminPolicy,
  ],
})
export class AccessControlModule {}
