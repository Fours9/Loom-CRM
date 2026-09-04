import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import { Employee } from '../employees/employee.entity';
import { EmploymentAssignment } from '../employees/employment-assignment.entity';
import { EmploymentAssignmentManagedDepartment } from '../employees/employment-assignment-managed-department.entity';
import { Department } from '../departments/department.entity';
import { CurrentEmploymentAssignmentResolver } from '../employment-catalog/current-employment-assignment.resolver';
import {
  ManagementKind,
  managementKindImpliesManager,
} from '../employment-catalog/management-kind';
import { AccessScope } from './access-scope';

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
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    private readonly currentAssignment: CurrentEmploymentAssignmentResolver,
    private readonly authorization: AuthorizationContextService,
  ) {}

  /**
   * Prefer AuthorizationContext.isAdminEquivalent. Mirror users.role===admin
   * remains valid when assign TX keeps compatibility mirror in sync.
   */
  isAdminRole(viewer: User): boolean {
    return viewer.role === UserRole.Admin;
  }

  /** Permission catalog role (User.role), not legacy isDepartmentManager flag. */
  isDepartmentManagerRole(viewer: User): boolean {
    return viewer.role === UserRole.DepartmentManager;
  }

  /** @deprecated Use isAdminRole — kept as alias for call-site migration. */
  isAdmin(viewer: User): boolean {
    return this.isAdminRole(viewer);
  }

  async isAdminEquivalentAsync(viewer: User): Promise<boolean> {
    return (await this.authorization.resolve(viewer.id)).isAdminEquivalent;
  }

  isOwner(viewer: User, target: Employee): boolean {
    return target.userId != null && target.userId === viewer.id;
  }

  /**
   * Permission-role manager (DM catalog role). Does NOT read User.isDepartmentManager.
   * For managed dept scope use resolveActorContext / resolveManagedScope.
   */
  isManager(viewer: User): boolean {
    return this.isDepartmentManagerRole(viewer);
  }

  async resolveActorContext(actor: User): Promise<ActorAccessContext> {
    const authz = await this.authorization.resolve(actor.id);
    if (authz.isAdminEquivalent) {
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
      managedDepartmentIds = await this.expandDirectionDepartmentIds(activeEa);
    }

    return {
      scope: 'managed_departments',
      employeeId: self.id,
      managedDepartmentIds,
    };
  }

  private async expandDirectionDepartmentIds(
    activeEa: EmploymentAssignment,
  ): Promise<string[]> {
    let directionId = activeEa.directionId;
    if (!directionId && activeEa.departmentId) {
      const dept = await this.departments.findOne({
        where: { id: activeEa.departmentId },
      });
      directionId = dept?.directionId ?? null;
    }
    if (!directionId) return [];
    const rows = await this.departments.find({
      where: { directionId },
      select: ['id'],
    });
    return rows.map((d) => d.id);
  }

  async resolveManagedScope(actor: User): Promise<string[]> {
    const ctx = await this.resolveActorContext(actor);
    return ctx.managedDepartmentIds;
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
    if (this.isAdminRole(actor)) return true;
    const ctx = await this.resolveActorContext(actor);
    if (ctx.scope === 'managed_departments') {
      const targetDeptId = await this.targetDepartmentId(target);
      return Boolean(
        targetDeptId && ctx.managedDepartmentIds.includes(targetDeptId),
      );
    }
    return false;
  }

  async canEditEmployeeSchedule(
    actor: User,
    target: Employee,
  ): Promise<boolean> {
    return this.canEditEmployeeProfile(actor, target);
  }

  async canViewWorkContacts(viewer: User, target: Employee): Promise<boolean> {
    if (this.isAdminRole(viewer) || this.isOwner(viewer, target)) return true;
    return this.canViewEmployeeProfile(viewer, target);
  }

  canViewAccountDetails(viewer: User, target: Employee): boolean {
    return this.isAdminRole(viewer) || this.isOwner(viewer, target);
  }

  canEditAccountEmail(viewer: User, target: Employee): boolean {
    return (
      this.isAdminRole(viewer) &&
      target.userId != null &&
      target.userId !== viewer.id
    );
  }

  canEditAdminAccess(viewer: User): boolean {
    return this.isAdminRole(viewer);
  }

  canViewComment(viewer: User, _target: Employee): boolean {
    return this.isAdminRole(viewer) || this.isDepartmentManagerRole(viewer);
  }

  canEditComment(viewer: User, target: Employee): Promise<boolean> {
    return this.canEditEmployeeProfile(viewer, target);
  }

  canViewAdminComment(viewer: User): boolean {
    return this.isAdminRole(viewer);
  }

  canEditAdminComment(viewer: User): boolean {
    return this.isAdminRole(viewer);
  }

  canViewPersonalContacts(viewer: User, target?: Employee): boolean {
    if (this.isAdminRole(viewer)) return true;
    if (target && this.isOwner(viewer, target)) return true;
    return false;
  }

  canEditPersonalContacts(viewer: User): boolean {
    return this.isAdminRole(viewer);
  }

  canViewEmergencyContact(viewer: User): boolean {
    return this.isAdminRole(viewer);
  }

  canEditEmergencyContact(viewer: User): boolean {
    return this.isAdminRole(viewer);
  }

  canCreateEmployeeAccount(viewer: User, target: Employee): boolean {
    return this.isAdminRole(viewer) && target.userId == null;
  }

  canManageExistingEmployeeAccount(viewer: User, target: Employee): boolean {
    return this.isAdminRole(viewer) && target.userId != null;
  }

  canResetEmployeePassword(viewer: User, target: Employee): boolean {
    return this.isAdminRole(viewer) && target.userId != null;
  }

  canDestructivelyManageAccount(actor: User, target: Employee): boolean {
    return (
      this.canManageExistingEmployeeAccount(actor, target) &&
      target.userId !== actor.id
    );
  }

  canDeleteEmployee(actor: User, target: Employee): boolean {
    return this.isAdminRole(actor) && target.userId !== actor.id;
  }

  async canExportProfilePdf(
    viewer: User,
    target: Employee,
  ): Promise<boolean> {
    if (!(this.isAdminRole(viewer) || this.isDepartmentManagerRole(viewer))) {
      return false;
    }
    return this.canViewEmployeeProfile(viewer, target);
  }

  canViewVisibilityOverrides(viewer: User, _targetRole: string): boolean {
    return this.isAdminRole(viewer);
  }

  canEditVisibilityOverrides(viewer: User, _targetRole: string): boolean {
    return this.isAdminRole(viewer);
  }

  private static readonly EMPLOYEE_CARD_RELATIONS = [
    'department',
    'department.direction',
    'position',
    'position.direction',
    'user',
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
