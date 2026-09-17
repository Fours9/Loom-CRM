import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { User } from '../identity/user.entity';
import { Permission } from '../permissions/permission.names';
import {
  isPermission,
  permissionsForPreset,
} from '../permissions/role-permissions';
import {
  AccountRole,
  AccountRolePermissionPreset,
} from './account-role.entity';
import { AccountRolePermission } from './account-role-permission.entity';
import { AccountRoleQuestionnaireTemplate } from './account-role-questionnaire-template.entity';
import { AccountRoleSurface } from './account-role-surface.entity';
import { AppSurface } from './app-surface.entity';
import { userRoleMirrorFor } from './account-role-mirror';
import { AuthorizationContextService } from './authorization-context.service';
import type { AuthorizationContext } from './authorization-context';
import { LastAdminPolicy } from './last-admin.policy';
import type { AssignableAccountRoleOption } from '@loom/contracts-access-control';

export type { AssignableAccountRoleOption } from '@loom/contracts-access-control';

const PERMISSION_PRESETS: readonly AccountRolePermissionPreset[] = [
  'employee',
  'department_manager',
  'admin',
];

const TEMPLATE_CODE_MAX = 64;
const TEMPLATE_CODE_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export type AccountRoleView = {
  id: string;
  code: string | null;
  name: string;
  permissionPreset: AccountRolePermissionPreset;
  isAdminEquivalent: boolean;
  isSystem: boolean;
  extraPermissions: Permission[];
  /** Preset ∪ extras (admin-equivalent roles resolve to the full set). */
  effectivePermissions: Permission[];
  surfaceIds: string[];
  userCount: number;
  /** Opaque questionnaire template codes granted to this role (sorted). */
  questionnaireTemplateCodes: string[];
  canEditQuestionnaireTemplates: boolean;
  /** Effective confidential.view (adminEq / preset / extras). */
  canViewConfidential: boolean;
  /** Extra row present for confidential.view. */
  grantsConfidentialExplicitly: boolean;
  /** Actor may toggle the confidential extra (adminEq actor + non-adminEq target). */
  canEditConfidentialGrant: boolean;
  canCreateEmployees: boolean;
  grantsCreateEmployeesExplicitly: boolean;
  canEditCreateEmployeesGrant: boolean;
  canManageProfiles: boolean;
  grantsManageProfilesExplicitly: boolean;
  canEditManageProfilesGrant: boolean;
  canAssignAccountRole: boolean;
  grantsAssignAccountRoleExplicitly: boolean;
  canEditAssignAccountRoleGrant: boolean;
  canCreateAccountAtCreate: boolean;
  grantsCreateAccountAtCreateExplicitly: boolean;
  canEditCreateAccountAtCreateGrant: boolean;
  canAssignQuestionnaires: boolean;
  grantsAssignQuestionnairesExplicitly: boolean;
  canEditAssignQuestionnairesGrant: boolean;
  /** Effective Manage bundle = lifecycle ∧ delete (or adminEq). */
  canManageQuestionnaires: boolean;
  grantsManageQuestionnairesExplicitly: boolean;
  canEditManageQuestionnairesGrant: boolean;
};

export type AppSurfaceView = {
  id: string;
  labelUa: string;
  groupKey: string;
  sortOrder: number;
};

export type CreateAccountRoleInput = {
  name: string;
  permissionPreset: AccountRolePermissionPreset;
  isAdminEquivalent?: boolean;
  extraPermissions?: string[];
  surfaceIds?: string[];
  questionnaireTemplateCodes?: string[];
};

export type UpdateAccountRoleInput = {
  name?: string;
  permissionPreset?: AccountRolePermissionPreset;
  isAdminEquivalent?: boolean;
  extraPermissions?: string[];
  surfaceIds?: string[];
  questionnaireTemplateCodes?: string[];
};

/** Account-role definition CRUD — admin-equivalent actors only (ADR 0011 §8). */
@Injectable()
export class AccountRolesService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly authorization: AuthorizationContextService,
    private readonly lastAdmin: LastAdminPolicy,
  ) {}

  async listSurfaces(actorUserId: string): Promise<AppSurfaceView[]> {
    await this.requireAdminEquivalent(actorUserId);
    const rows = await this.dataSource.getRepository(AppSurface).find({
      order: { groupKey: 'ASC', sortOrder: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      labelUa: row.labelUa,
      groupKey: row.groupKey,
      sortOrder: row.sortOrder,
    }));
  }

  async list(actorUserId: string): Promise<AccountRoleView[]> {
    const actorCtx = await this.requireAdminEquivalent(actorUserId);
    const roles = await this.dataSource.getRepository(AccountRole).find({
      order: { isSystem: 'DESC', name: 'ASC' },
    });
    return Promise.all(
      roles.map((role) =>
        this.toView(this.dataSource.manager, role, actorCtx),
      ),
    );
  }

  /**
   * Slim catalog for AccountRole pickers (create / Role Access).
   * assign_account_role OR adminEquivalent — not full Settings list().
   */
  async listAssignable(
    actorUserId: string,
  ): Promise<AssignableAccountRoleOption[]> {
    const actorCtx = await this.authorization.resolve(actorUserId);
    const mayList =
      actorCtx.isAdminEquivalent ||
      actorCtx.permissions.includes(Permission.EmployeesAssignAccountRole);
    if (!mayList) {
      throw new ForbiddenException();
    }
    const roles = await this.dataSource.getRepository(AccountRole).find({
      order: { isSystem: 'DESC', name: 'ASC' },
    });
    return roles
      .filter((role) => actorCtx.isAdminEquivalent || !role.isAdminEquivalent)
      .map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        isAdminEquivalent: role.isAdminEquivalent,
      }));
  }

  async get(actorUserId: string, id: string): Promise<AccountRoleView> {
    const actorCtx = await this.requireAdminEquivalent(actorUserId);
    const role = await this.getRoleOrFail(this.dataSource.manager, id);
    return this.toView(this.dataSource.manager, role, actorCtx);
  }

  async create(
    actorUserId: string,
    input: CreateAccountRoleInput,
  ): Promise<AccountRoleView> {
    await this.requireAdminEquivalent(actorUserId);

    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const preset = this.assertPreset(input.permissionPreset);
    const isAdminEquivalent = Boolean(input.isAdminEquivalent);
    this.assertAdminPresetConsistency(preset, isAdminEquivalent);
    const extras = this.assertPermissions(input.extraPermissions ?? []);

    const id = await this.dataSource.transaction(async (manager) => {
      const surfaceIds = await this.assertSurfaceIds(
        manager,
        input.surfaceIds ?? [],
      );
      const repo = manager.getRepository(AccountRole);
      const saved = await repo.save(
        repo.create({
          code: null,
          name,
          permissionPreset: preset,
          isAdminEquivalent,
          isSystem: false,
        }),
      );
      await this.replaceExtras(manager, saved.id, extras);
      await this.replaceSurfaceRows(manager, saved.id, surfaceIds);
      if (input.questionnaireTemplateCodes !== undefined) {
        const codes = this.assertTemplateCodes(input.questionnaireTemplateCodes);
        await this.replaceTemplateRows(manager, saved.id, codes);
      }
      return saved.id;
    });

    return this.get(actorUserId, id);
  }

  async update(
    actorUserId: string,
    id: string,
    input: UpdateAccountRoleInput,
  ): Promise<AccountRoleView> {
    // Pre-mutation AuthZ: security-definition writes require adminEquivalent already.
    await this.requireAdminEquivalent(actorUserId);

    await this.dataSource.transaction(async (manager) => {
      const role = await this.lockRole(manager, id);

      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw new BadRequestException('name is required');
        role.name = name;
      }

      let definitionChanged = false;

      if (input.permissionPreset !== undefined) {
        const preset = this.assertPreset(input.permissionPreset);
        if (role.isSystem && preset !== role.permissionPreset) {
          throw new ConflictException(
            'permissionPreset is immutable for system roles',
          );
        }
        if (preset !== role.permissionPreset) {
          role.permissionPreset = preset;
          definitionChanged = true;
        }
      }

      if (input.isAdminEquivalent !== undefined) {
        const next = Boolean(input.isAdminEquivalent);
        if (role.isSystem && next !== role.isAdminEquivalent) {
          throw new ConflictException(
            'isAdminEquivalent is immutable for system roles',
          );
        }
        if (next !== role.isAdminEquivalent) {
          await this.lastAdmin.assertRoleDemotionAllowed(
            manager,
            role.id,
            next,
          );
          role.isAdminEquivalent = next;
          definitionChanged = true;
        }
      }

      this.assertAdminPresetConsistency(
        role.permissionPreset,
        role.isAdminEquivalent,
      );

      if (input.extraPermissions !== undefined) {
        const extras = this.assertPermissions(input.extraPermissions);
        const before = await this.currentExtras(manager, role.id);
        if (!sameStringSet(before, extras)) {
          await this.replaceExtras(manager, role.id, extras);
          definitionChanged = true;
        }
      }

      if (input.surfaceIds !== undefined) {
        const surfaceIds = await this.assertSurfaceIds(
          manager,
          input.surfaceIds,
        );
        const before = await this.currentSurfaceIds(manager, role.id);
        if (!sameStringSet(before, surfaceIds)) {
          await this.replaceSurfaceRows(manager, role.id, surfaceIds);
          definitionChanged = true;
        }
      }

      if (input.questionnaireTemplateCodes !== undefined) {
        if (role.isAdminEquivalent) {
          throw new BadRequestException(
            'questionnaireTemplateCodes cannot be set on admin-equivalent roles',
          );
        }
        const codes = this.assertTemplateCodes(input.questionnaireTemplateCodes);
        const before = await this.currentTemplateCodes(manager, role.id);
        if (!sameStringSet(before, codes)) {
          await this.replaceTemplateRows(manager, role.id, codes);
          definitionChanged = true;
        }
      }

      await manager.getRepository(AccountRole).save(role);

      if (definitionChanged) {
        await this.bumpTokenVersionForRole(manager, role.id);
        await this.syncLegacyRoleMirror(manager, role);
      }
    });

    return this.get(actorUserId, id);
  }

  async replaceSurfaces(
    actorUserId: string,
    id: string,
    surfaceIds: string[],
  ): Promise<AccountRoleView> {
    return this.update(actorUserId, id, { surfaceIds });
  }

  async replaceQuestionnaireTemplates(
    actorUserId: string,
    id: string,
    questionnaireTemplateCodes: string[],
  ): Promise<AccountRoleView> {
    return this.update(actorUserId, id, { questionnaireTemplateCodes });
  }

  async remove(actorUserId: string, id: string): Promise<void> {
    await this.requireAdminEquivalent(actorUserId);
    await this.dataSource.transaction(async (manager) => {
      const role = await this.lockRole(manager, id);
      if (role.isSystem) {
        throw new ConflictException('System roles cannot be deleted');
      }
      const users = await manager
        .getRepository(User)
        .count({ where: { accountRoleId: role.id } });
      if (users > 0) {
        throw new ConflictException(
          `Cannot delete role: ${users} user(s) still reference it`,
        );
      }
      await manager.getRepository(AccountRole).delete({ id: role.id });
    });
  }

  /**
   * Resolve actor AuthZ BEFORE any security-definition mutation.
   * All create/update/replace/remove paths call this first (ADR 0011 §8 + ADR 0012).
   */
  private async requireAdminEquivalent(
    actorUserId: string,
  ): Promise<AuthorizationContext> {
    const context = await this.authorization.resolve(actorUserId);
    if (!context.isAdminEquivalent) {
      throw new ForbiddenException('Admin-equivalent access required');
    }
    return context;
  }

  private assertPreset(value: unknown): AccountRolePermissionPreset {
    if (
      typeof value !== 'string' ||
      !(PERMISSION_PRESETS as readonly string[]).includes(value)
    ) {
      throw new BadRequestException(
        `permissionPreset must be one of: ${PERMISSION_PRESETS.join(', ')}`,
      );
    }
    return value as AccountRolePermissionPreset;
  }

  private assertAdminPresetConsistency(
    preset: AccountRolePermissionPreset,
    isAdminEquivalent: boolean,
  ): void {
    if (preset === 'admin' && !isAdminEquivalent) {
      throw new BadRequestException(
        'permissionPreset "admin" requires isAdminEquivalent = true',
      );
    }
  }

  private assertPermissions(values: string[]): Permission[] {
    const unique = [...new Set(values.map((v) => v?.trim()).filter(Boolean))];
    const deprecated = unique.filter(
      (value) => value === Permission.EmployeesEdit,
    );
    if (deprecated.length) {
      throw new BadRequestException(
        `Deprecated permission(s) cannot be granted: ${deprecated.join(', ')}. Use employees.manage_profiles.`,
      );
    }
    const invalid = unique.filter((value) => !isPermission(value));
    if (invalid.length) {
      throw new BadRequestException(
        `Unknown permission(s): ${invalid.join(', ')}`,
      );
    }
    const hasLifecycle = unique.includes(Permission.QuestionnairesManageLifecycle);
    const hasDelete = unique.includes(Permission.QuestionnairesDelete);
    if (hasLifecycle !== hasDelete) {
      throw new BadRequestException({
        code: 'QUESTIONNAIRE_MANAGE_BUNDLE_PARTIAL',
        message:
          'questionnaires.manage_lifecycle and questionnaires.delete must be granted or revoked together',
      });
    }
    return unique as Permission[];
  }

  private assertTemplateCodes(values: string[]): string[] {
    const unique = [
      ...new Set(
        values
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter(Boolean),
      ),
    ];
    for (const code of unique) {
      if (code.length > TEMPLATE_CODE_MAX || !TEMPLATE_CODE_RE.test(code)) {
        throw new BadRequestException(
          `Invalid questionnaire template code: ${code}`,
        );
      }
    }
    return unique.sort();
  }

  private async assertSurfaceIds(
    manager: EntityManager,
    values: string[],
  ): Promise<string[]> {
    const unique = [...new Set(values.map((v) => v?.trim()).filter(Boolean))];
    if (!unique.length) return [];
    const found = await manager.getRepository(AppSurface).find({
      where: { id: In(unique) },
    });
    const known = new Set(found.map((row) => row.id));
    const missing = unique.filter((id) => !known.has(id));
    if (missing.length) {
      throw new BadRequestException(`Unknown surface(s): ${missing.join(', ')}`);
    }
    return unique;
  }

  private async getRoleOrFail(
    manager: EntityManager,
    id: string,
  ): Promise<AccountRole> {
    const role = await manager.getRepository(AccountRole).findOne({
      where: { id },
    });
    if (!role) throw new NotFoundException('Account role not found');
    return role;
  }

  private async lockRole(
    manager: EntityManager,
    id: string,
  ): Promise<AccountRole> {
    const role = await manager.getRepository(AccountRole).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!role) throw new NotFoundException('Account role not found');
    return role;
  }

  private async currentExtras(
    manager: EntityManager,
    accountRoleId: string,
  ): Promise<string[]> {
    const rows = await manager
      .getRepository(AccountRolePermission)
      .find({ where: { accountRoleId } });
    return rows.map((row) => row.permission);
  }

  private async currentSurfaceIds(
    manager: EntityManager,
    accountRoleId: string,
  ): Promise<string[]> {
    const rows = await manager
      .getRepository(AccountRoleSurface)
      .find({ where: { accountRoleId } });
    return rows.map((row) => row.surfaceId);
  }

  private async currentTemplateCodes(
    manager: EntityManager,
    accountRoleId: string,
  ): Promise<string[]> {
    const rows = await manager
      .getRepository(AccountRoleQuestionnaireTemplate)
      .find({ where: { accountRoleId } });
    return rows.map((row) => row.templateCode).sort();
  }

  private async replaceExtras(
    manager: EntityManager,
    accountRoleId: string,
    permissions: Permission[],
  ): Promise<void> {
    const repo = manager.getRepository(AccountRolePermission);
    await repo.delete({ accountRoleId });
    if (!permissions.length) return;
    await repo.save(
      permissions.map((permission) => repo.create({ accountRoleId, permission })),
    );
  }

  private async replaceSurfaceRows(
    manager: EntityManager,
    accountRoleId: string,
    surfaceIds: string[],
  ): Promise<void> {
    const repo = manager.getRepository(AccountRoleSurface);
    await repo.delete({ accountRoleId });
    if (!surfaceIds.length) return;
    await repo.save(
      surfaceIds.map((surfaceId) => repo.create({ accountRoleId, surfaceId })),
    );
  }

  private async replaceTemplateRows(
    manager: EntityManager,
    accountRoleId: string,
    templateCodes: string[],
  ): Promise<void> {
    const repo = manager.getRepository(AccountRoleQuestionnaireTemplate);
    await repo.delete({ accountRoleId });
    if (!templateCodes.length) return;
    await repo.save(
      templateCodes.map((templateCode) =>
        repo.create({ accountRoleId, templateCode }),
      ),
    );
  }

  /** Role definition change invalidates every session on that role. */
  private async bumpTokenVersionForRole(
    manager: EntityManager,
    accountRoleId: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE "users" SET "token_version" = "token_version" + 1 WHERE "account_role_id" = $1`,
      [accountRoleId],
    );
  }

  /** users.role is a compatibility mirror only (ADR 0011 §3). */
  private async syncLegacyRoleMirror(
    manager: EntityManager,
    role: AccountRole,
  ): Promise<void> {
    const mirror = userRoleMirrorFor(role);
    await manager.query(
      `UPDATE "users" SET "role" = $1 WHERE "account_role_id" = $2 AND "role" <> $1`,
      [mirror, role.id],
    );
  }

  private async toView(
    manager: EntityManager,
    role: AccountRole,
    actorCtx: AuthorizationContext,
  ): Promise<AccountRoleView> {
    const [extras, surfaceIds, templateCodes, userCount] = await Promise.all([
      this.currentExtras(manager, role.id),
      this.currentSurfaceIds(manager, role.id),
      this.currentTemplateCodes(manager, role.id),
      manager.getRepository(User).count({ where: { accountRoleId: role.id } }),
    ]);
    const extraPermissions = extras.filter(isPermission);
    const effectivePermissions = role.isAdminEquivalent
      ? permissionsForPreset('admin')
      : [
          ...new Set([
            ...permissionsForPreset(role.permissionPreset),
            ...extraPermissions,
          ]),
        ];

    const canEditGrant =
      actorCtx.isAdminEquivalent && !role.isAdminEquivalent;

    const grantsConfidentialExplicitly = extraPermissions.includes(
      Permission.ConfidentialView,
    );
    const canViewConfidential =
      role.isAdminEquivalent ||
      effectivePermissions.includes(Permission.ConfidentialView);

    const grantsCreateEmployeesExplicitly = extraPermissions.includes(
      Permission.EmployeesCreate,
    );
    const canCreateEmployees =
      role.isAdminEquivalent ||
      effectivePermissions.includes(Permission.EmployeesCreate);

    const grantsManageProfilesExplicitly = extraPermissions.includes(
      Permission.EmployeesManageProfiles,
    );
    const canManageProfiles =
      role.isAdminEquivalent ||
      effectivePermissions.includes(Permission.EmployeesManageProfiles);

    const grantsAssignAccountRoleExplicitly = extraPermissions.includes(
      Permission.EmployeesAssignAccountRole,
    );
    const canAssignAccountRole =
      role.isAdminEquivalent ||
      effectivePermissions.includes(Permission.EmployeesAssignAccountRole);

    const grantsCreateAccountAtCreateExplicitly = extraPermissions.includes(
      Permission.EmployeesCreateAccountAtCreate,
    );
    const canCreateAccountAtCreate =
      role.isAdminEquivalent ||
      effectivePermissions.includes(Permission.EmployeesCreateAccountAtCreate);

    const grantsAssignQuestionnairesExplicitly = extraPermissions.includes(
      Permission.QuestionnairesAssign,
    );
    const canAssignQuestionnaires =
      role.isAdminEquivalent ||
      effectivePermissions.includes(Permission.QuestionnairesAssign);

    const grantsLifecycleExplicitly = extraPermissions.includes(
      Permission.QuestionnairesManageLifecycle,
    );
    const grantsDeleteExplicitly = extraPermissions.includes(
      Permission.QuestionnairesDelete,
    );
    const grantsManageQuestionnairesExplicitly =
      grantsLifecycleExplicitly && grantsDeleteExplicitly;
    const canManageQuestionnaires =
      role.isAdminEquivalent ||
      (effectivePermissions.includes(Permission.QuestionnairesManageLifecycle) &&
        effectivePermissions.includes(Permission.QuestionnairesDelete));

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      permissionPreset: role.permissionPreset,
      isAdminEquivalent: role.isAdminEquivalent,
      isSystem: role.isSystem,
      extraPermissions,
      effectivePermissions,
      surfaceIds: [...surfaceIds].sort(),
      userCount,
      questionnaireTemplateCodes: templateCodes,
      canEditQuestionnaireTemplates: canEditGrant,
      canViewConfidential,
      grantsConfidentialExplicitly,
      canEditConfidentialGrant: canEditGrant,
      canCreateEmployees,
      grantsCreateEmployeesExplicitly,
      canEditCreateEmployeesGrant: canEditGrant,
      canManageProfiles,
      grantsManageProfilesExplicitly,
      canEditManageProfilesGrant: canEditGrant,
      canAssignAccountRole,
      grantsAssignAccountRoleExplicitly,
      canEditAssignAccountRoleGrant: canEditGrant,
      canCreateAccountAtCreate,
      grantsCreateAccountAtCreateExplicitly,
      canEditCreateAccountAtCreateGrant: canEditGrant,
      canAssignQuestionnaires,
      grantsAssignQuestionnairesExplicitly,
      canEditAssignQuestionnairesGrant: canEditGrant,
      canManageQuestionnaires,
      grantsManageQuestionnairesExplicitly,
      canEditManageQuestionnairesGrant: canEditGrant,
    };
  }
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a);
  return b.every((value) => left.has(value));
}
