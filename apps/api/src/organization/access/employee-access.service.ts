import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import {
  hasPermission,
  type AuthorizationContext,
} from '../../platform/access-control/authorization-context';
import { Permission } from '../../platform/permissions/permission.names';
import { Employee } from '../employees/employee.entity';
import { EmploymentAssignment } from '../employees/employment-assignment.entity';
import { EmploymentAssignmentManagedDepartment } from '../employees/employment-assignment-managed-department.entity';
import { EmploymentAssignmentManagedDirection } from '../employees/employment-assignment-managed-direction.entity';
import { Department } from '../departments/department.entity';
import {
  CurrentEmploymentAssignmentResolver,
  selectCurrentEmploymentAssignment,
} from '../employment-catalog/current-employment-assignment.resolver';
import {
  ManagementKind,
  managementKindImpliesManager,
} from '../employment-catalog/management-kind';
import { AccessScope } from './access-scope';
import {
  canDeleteEmployee as canDeleteEmployeeAuthz,
  canDestructivelyManageAccount as canDestructivelyManageAccountAuthz,
  canEditAccountEmail as canEditAccountEmailAuthz,
  canEditAdminComment as canEditAdminCommentAuthz,
  canEditVisibilityOverrides as canEditVisibilityOverridesAuthz,
  canExportProfile,
  canResetPassword,
  canViewAccountDetails as canViewAccountDetailsAuthz,
  canViewAdminComment as canViewAdminCommentAuthz,
  canViewPersonalContacts as canViewPersonalContactsAuthz,
  canViewTeamComment,
  canViewVisibilityOverrides as canViewVisibilityOverridesAuthz,
  canViewWorkContacts as canViewWorkContactsAuthz,
  canViewEmergencyContact as canViewEmergencyContactAuthz,
} from '../employees/employee-profile-authz';

export type ActorAccessContext = {
  scope: AccessScope;
  employeeId: string | null;
  managedDepartmentIds: string[];
};

export type TargetAccessFacts = {
  isOwner: boolean;
  isInScope: boolean;
  /** Visible via managed_departments / direction expand — not owner/all alone. */
  isViaManagedScope: boolean;
};

@Injectable()
export class EmployeeAccessService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(EmploymentAssignment)
    private readonly assignments: Repository<EmploymentAssignment>,
    @InjectRepository(EmploymentAssignmentManagedDepartment)
    private readonly eaManaged: Repository<EmploymentAssignmentManagedDepartment>,
    @InjectRepository(EmploymentAssignmentManagedDirection)
    private readonly eaManagedDirections: Repository<EmploymentAssignmentManagedDirection>,
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    private readonly currentAssignment: CurrentEmploymentAssignmentResolver,
    private readonly authorization: AuthorizationContextService,
  ) {}

  async isAdminEquivalentAsync(viewer: User): Promise<boolean> {
    return (await this.authorization.resolve(viewer.id)).isAdminEquivalent;
  }

  isOwner(viewer: User, target: Employee): boolean {
    return target.userId != null && target.userId === viewer.id;
  }

  private async resolveAuthz(
    viewer: User,
    authz?: AuthorizationContext,
  ): Promise<AuthorizationContext> {
    return authz ?? (await this.authorization.resolve(viewer.id));
  }

  /**
   * @param authz Optional pre-resolved AuthZ — avoids a second AuthorizationContextService.resolve
   * when the caller already holds the snapshot (Absences AbsenceActorFacts).
   */
  async resolveActorContext(
    actor: User,
    authz?: Awaited<ReturnType<AuthorizationContextService['resolve']>>,
  ): Promise<ActorAccessContext> {
    const resolved = authz ?? (await this.authorization.resolve(actor.id));
    if (resolved.isAdminEquivalent) {
      const self = await this.employees.findOne({ where: { userId: actor.id } });
      return {
        scope: 'all',
        employeeId: self?.id ?? null,
        managedDepartmentIds: [],
      };
    }

    const self = await this.employees.findOne({ where: { userId: actor.id } });
    if (!self) {
      return { scope: 'self', employeeId: null, managedDepartmentIds: [] };
    }

    const activeEa = await this.currentAssignment.resolve(self);
    const kind =
      (activeEa?.managementKind as ManagementKind | undefined) ??
      (activeEa?.isDepartmentManager
        ? ManagementKind.Departments
        : ManagementKind.None);

    if (!activeEa || !managementKindImpliesManager(kind)) {
      return {
        scope: 'self',
        employeeId: self.id,
        managedDepartmentIds: [],
      };
    }

    let managedDepartmentIds: string[] = [];
    if (kind === ManagementKind.Departments) {
      managedDepartmentIds = await this.managedDepartmentIdsForAssignment(
        activeEa.id,
      );
    } else if (kind === ManagementKind.Direction) {
      managedDepartmentIds = await this.expandManagedDirectionsToDepartments(
        activeEa,
      );
    }

    return {
      scope: 'managed_departments',
      employeeId: self.id,
      managedDepartmentIds,
    };
  }

  /**
   * Single entry: `direction` leadership → departments of all managed directions.
   * Join rows are SoT; EA.directionId is legacy fallback only when joins are empty.
   */
  private async expandManagedDirectionsToDepartments(
    activeEa: EmploymentAssignment,
  ): Promise<string[]> {
    const directionIds = await this.managedDirectionIdsForAssignment(
      activeEa.id,
    );
    const ids =
      directionIds.length > 0
        ? directionIds
        : await this.legacySingleDirectionFallback(activeEa);
    if (!ids.length) return [];

    const rows = await this.departments
      .createQueryBuilder('d')
      .select('d.id', 'id')
      .where('d.direction_id IN (:...ids)', { ids })
      .getRawMany<{ id: string }>();
    return rows.map((d) => d.id);
  }

  private async managedDirectionIdsForAssignment(
    assignmentId: string,
  ): Promise<string[]> {
    const rows = await this.eaManagedDirections.find({
      where: { assignmentId },
      select: ['directionId'],
    });
    return rows.map((r) => r.directionId);
  }

  private async legacySingleDirectionFallback(
    activeEa: EmploymentAssignment,
  ): Promise<string[]> {
    let directionId = activeEa.directionId;
    if (!directionId && activeEa.departmentId) {
      const dept = await this.departments.findOne({
        where: { id: activeEa.departmentId },
      });
      directionId = dept?.directionId ?? null;
    }
    return directionId ? [directionId] : [];
  }

  async resolveManagedScope(actor: User): Promise<string[]> {
    const ctx = await this.resolveActorContext(actor);
    return ctx.managedDepartmentIds;
  }

  /**
   * Batch current active EA departmentId for employees (Absences submission-dept fallback).
   * Single query — do not N× resolve per row.
   */
  async batchCurrentDepartmentIds(
    employees: ReadonlyArray<{ id: string; currentAssignmentId: string | null }>,
  ): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    if (!employees.length) return out;

    const employeeIds = employees.map((e) => e.id);
    const pointerByEmployee = new Map(
      employees.map((e) => [e.id, e.currentAssignmentId] as const),
    );

    const rows = await this.assignments.find({
      where: { employeeId: In(employeeIds), status: 'active' },
      select: ['id', 'employeeId', 'departmentId', 'startDate', 'status'],
    });

    const byEmployee = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byEmployee.get(row.employeeId) ?? [];
      list.push(row);
      byEmployee.set(row.employeeId, list);
    }

    for (const emp of employees) {
      const candidates = byEmployee.get(emp.id) ?? [];
      const pointer = pointerByEmployee.get(emp.id) ?? null;
      const selected = selectCurrentEmploymentAssignment(
        candidates.map((c) => ({
          id: c.id,
          employeeId: c.employeeId,
          status: c.status,
          startDate: c.startDate,
        })),
        emp.id,
        pointer,
      );
      if (!selected) {
        out.set(emp.id, null);
        continue;
      }
      const full = candidates.find((c) => c.id === selected.id);
      out.set(emp.id, full?.departmentId ?? null);
    }
    return out;
  }

  async requireCanView(actor: User, target: Employee): Promise<void> {
    if (!(await this.canViewEmployeeProfile(actor, target))) {
      throw new ForbiddenException('Cannot view employee');
    }
  }

  async requireCanEdit(actor: User, target: Employee): Promise<void> {
    if (!(await this.canEditEmployeeProfile(actor, target))) {
      throw new ForbiddenException('Cannot edit employee');
    }
  }

  async canViewEmployeeProfile(
    actor: User,
    target: Employee,
  ): Promise<boolean> {
    const facts = await this.resolveTargetAccess(actor, target);
    return facts.isInScope;
  }

  /**
   * Canonical target facts for document type/resource policies (ADR 0012).
   * Department resolution stays here — callers must not reconstruct managed scope.
   */
  async resolveTargetAccess(
    actor: User,
    target: Employee,
    actorContext?: ActorAccessContext,
  ): Promise<TargetAccessFacts> {
    const ctx = actorContext ?? (await this.resolveActorContext(actor));
    const isOwner = this.isOwner(actor, target);

    if (ctx.scope === 'all') {
      return { isOwner, isInScope: true, isViaManagedScope: false };
    }

    if (isOwner) {
      return { isOwner: true, isInScope: true, isViaManagedScope: false };
    }

    if (ctx.scope === 'managed_departments') {
      const targetDeptId = await this.targetDepartmentId(target);
      const isViaManagedScope = Boolean(
        targetDeptId && ctx.managedDepartmentIds.includes(targetDeptId),
      );
      return {
        isOwner: false,
        isInScope: isViaManagedScope,
        isViaManagedScope,
      };
    }

    return { isOwner: false, isInScope: false, isViaManagedScope: false };
  }

  async canEditEmployeeProfile(
    actor: User,
    target: Employee,
  ): Promise<boolean> {
    const authz = await this.authorization.resolve(actor.id);
    if (authz.isAdminEquivalent) return true;
    if (!hasPermission(authz, Permission.EmployeesManageProfiles)) {
      return false;
    }
    const ctx = await this.resolveActorContext(actor);
    if (ctx.scope !== 'managed_departments') return false;
    const targetDeptId = await this.targetDepartmentId(target);
    return Boolean(
      targetDeptId && ctx.managedDepartmentIds.includes(targetDeptId),
    );
  }

  async canEditEmployeeSchedule(
    actor: User,
    target: Employee,
  ): Promise<boolean> {
    return this.canEditEmployeeProfile(actor, target);
  }

  async canViewWorkContacts(
    viewer: User,
    target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(viewer, authz);
    const isOwner = this.isOwner(viewer, target);
    if (resolved.isAdminEquivalent || isOwner) return true;
    const canView = await this.canViewEmployeeProfile(viewer, target);
    return canViewWorkContactsAuthz(resolved, isOwner, canView);
  }

  async canViewAccountDetails(
    viewer: User,
    target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(viewer, authz);
    return canViewAccountDetailsAuthz(resolved, this.isOwner(viewer, target));
  }

  async canEditAccountEmail(
    viewer: User,
    target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(viewer, authz);
    return canEditAccountEmailAuthz(resolved, {
      hasOtherUser: target.userId != null,
      isSelf: target.userId === viewer.id,
    });
  }

  async canEditAdminAccess(
    viewer: User,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(viewer, authz);
    return (
      resolved.isAdminEquivalent ||
      hasPermission(resolved, Permission.EmployeesAssignAccountRole)
    );
  }

  async canViewComment(
    viewer: User,
    _target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    return canViewTeamComment(await this.resolveAuthz(viewer, authz));
  }

  canEditComment(viewer: User, target: Employee): Promise<boolean> {
    return this.canEditEmployeeProfile(viewer, target);
  }

  async canViewAdminComment(
    viewer: User,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    return canViewAdminCommentAuthz(await this.resolveAuthz(viewer, authz));
  }

  async canEditAdminComment(
    viewer: User,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    return canEditAdminCommentAuthz(await this.resolveAuthz(viewer, authz));
  }

  async canViewPersonalContacts(
    viewer: User,
    target?: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(viewer, authz);
    const isOwner = target ? this.isOwner(viewer, target) : false;
    return canViewPersonalContactsAuthz(resolved, isOwner);
  }

  async canViewEmergencyContact(
    viewer: User,
    target?: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(viewer, authz);
    const isOwner = target ? this.isOwner(viewer, target) : false;
    return canViewEmergencyContactAuthz(resolved, isOwner);
  }

  async canCreateEmployeeAccount(
    viewer: User,
    target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    if (target.userId != null) return false;
    const resolved = await this.resolveAuthz(viewer, authz);
    if (resolved.isAdminEquivalent) return true;
    if (!hasPermission(resolved, Permission.EmployeesCreate)) return false;
    const ctx = await this.resolveActorContext(viewer, resolved);
    if (ctx.scope !== 'managed_departments') return false;
    const targetDeptId = await this.targetDepartmentId(target);
    return Boolean(
      targetDeptId && ctx.managedDepartmentIds.includes(targetDeptId),
    );
  }

  async canResetEmployeePassword(
    viewer: User,
    target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(viewer, authz);
    return canResetPassword(resolved, target.userId != null);
  }

  async canDestructivelyManageAccount(
    actor: User,
    target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(actor, authz);
    return canDestructivelyManageAccountAuthz(
      resolved,
      target.userId != null,
      target.userId === actor.id,
    );
  }

  async canDeleteEmployee(
    actor: User,
    target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(actor, authz);
    return canDeleteEmployeeAuthz(resolved, target.userId === actor.id);
  }

  async canExportProfilePdf(
    viewer: User,
    target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const resolved = await this.resolveAuthz(viewer, authz);
    const canView = await this.canViewEmployeeProfile(viewer, target);
    return canExportProfile(resolved, canView);
  }

  async canViewVisibilityOverrides(
    viewer: User,
    _targetRole: string,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    return canViewVisibilityOverridesAuthz(
      await this.resolveAuthz(viewer, authz),
    );
  }

  /**
   * Managed-department membership for the target (includes owner when own dept managed).
   * Distinct from resolveTargetAccess.isViaManagedScope (owner short-circuit).
   */
  async isTargetInManagedDepartments(
    actor: User,
    target: Employee,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    const ctx = await this.resolveActorContext(actor, authz);
    if (ctx.scope !== 'managed_departments') return false;
    const targetDeptId = await this.targetDepartmentId(target);
    return Boolean(
      targetDeptId && ctx.managedDepartmentIds.includes(targetDeptId),
    );
  }

  async canEditVisibilityOverrides(
    viewer: User,
    _targetRole: string,
    authz?: AuthorizationContext,
  ): Promise<boolean> {
    return canEditVisibilityOverridesAuthz(
      await this.resolveAuthz(viewer, authz),
    );
  }

  private static readonly EMPLOYEE_CARD_RELATIONS = [
    'department',
    'department.direction',
    'position',
    'position.direction',
    'user',
    'user.accountRole',
  ] as const;

  /**
   * visible = self ∪ managed departments (same semantics as canView).
   * Target dept from active EA (batch), never employees.departmentId as auth SoT.
   */
  async listVisibleEmployees(actor: User): Promise<Employee[]> {
    const ctx = await this.resolveActorContext(actor);
    const relations = [...EmployeeAccessService.EMPLOYEE_CARD_RELATIONS];

    if (ctx.scope === 'all') {
      return this.employees.find({
        relations,
        order: { lastName: 'ASC' },
      });
    }

    if (ctx.scope === 'self') {
      if (!ctx.employeeId) return [];
      const self = await this.employees.findOne({
        where: { id: ctx.employeeId },
        relations,
      });
      return self ? [self] : [];
    }

    // managed_departments: self ∪ targets whose active EA.departmentId ∈ managed
    const candidates = await this.employees.find({
      relations,
      order: { lastName: 'ASC' },
    });
    if (!candidates.length) return [];

    const deptByEmployeeId = await this.batchActiveDepartmentIds(
      candidates.map((e) => e.id),
    );

    const managed = new Set(ctx.managedDepartmentIds);
    return candidates.filter((e) => {
      if (ctx.employeeId && e.id === ctx.employeeId) return true;
      const deptId = deptByEmployeeId.get(e.id);
      return Boolean(deptId && managed.has(deptId));
    });
  }

  async getEmployeeOrFail(id: string): Promise<Employee> {
    const emp = await this.employees.findOne({
      where: { id },
      relations: [...EmployeeAccessService.EMPLOYEE_CARD_RELATIONS],
    });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  /** @deprecated Prefer resolveManagedScope — kept for transitional call sites. */
  async managedDepartmentIds(actor: User): Promise<string[]> {
    return this.resolveManagedScope(actor);
  }

  private async managedDepartmentIdsForAssignment(
    assignmentId: string,
  ): Promise<string[]> {
    const rows = await this.eaManaged.find({ where: { assignmentId } });
    return rows.map((r) => r.departmentId);
  }

  private async targetDepartmentId(target: Employee): Promise<string | null> {
    const ea = await this.currentAssignment.resolve(target);
    return ea?.departmentId ?? null;
  }

  private async batchActiveDepartmentIds(
    employeeIds: string[],
  ): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    if (!employeeIds.length) return result;

    const rows = await this.assignments
      .createQueryBuilder('ea')
      .select(['ea.id', 'ea.employeeId', 'ea.departmentId', 'ea.startDate'])
      .where('ea.employee_id IN (:...ids)', { ids: employeeIds })
      .andWhere('ea.status = :status', { status: 'active' })
      .orderBy('ea.start_date', 'DESC', 'NULLS LAST')
      .addOrderBy('ea.id', 'DESC')
      .getMany();

    // First row per employee wins (ordered newest first)
    for (const row of rows) {
      if (!result.has(row.employeeId)) {
        result.set(row.employeeId, row.departmentId);
      }
    }
    for (const id of employeeIds) {
      if (!result.has(id)) result.set(id, null);
    }
    return result;
  }
}
