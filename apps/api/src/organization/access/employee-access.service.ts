import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { Employee } from '../employees/employee.entity';
import { EmployeeManagedDepartment } from '../employees/employee-managed-department.entity';
import { AccessScope, scopeForRole } from './access-scope';

@Injectable()
export class EmployeeAccessService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(EmployeeManagedDepartment)
    private readonly managed: Repository<EmployeeManagedDepartment>,
  ) {}

  scope(actor: User): AccessScope {
    return scopeForRole(actor.role);
  }

  isAdmin(viewer: User): boolean {
    return viewer.role === UserRole.Admin;
  }

  isOwner(viewer: User, target: Employee): boolean {
    return target.userId != null && target.userId === viewer.id;
  }

  isManager(viewer: User): boolean {
    return (
      viewer.role === UserRole.DepartmentManager ||
      Boolean(viewer.isDepartmentManager)
    );
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
    if (this.scope(actor) === 'all') return true;
    if (this.isOwner(actor, target)) return true;
    if (this.scope(actor) === 'managed_departments') {
      const deptIds = await this.managedDepartmentIds(actor);
      return Boolean(
        target.departmentId && deptIds.includes(target.departmentId),
      );
    }
    return false;
  }

  async canEditEmployeeProfile(
    actor: User,
    target: Employee,
  ): Promise<boolean> {
    if (this.isAdmin(actor)) return true;
    if (this.scope(actor) === 'managed_departments') {
      const deptIds = await this.managedDepartmentIds(actor);
      return Boolean(
        target.departmentId && deptIds.includes(target.departmentId),
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
    if (this.isAdmin(viewer) || this.isOwner(viewer, target)) return true;
    return this.canViewEmployeeProfile(viewer, target);
  }

  canViewAccountDetails(viewer: User, target: Employee): boolean {
    return this.isAdmin(viewer) || this.isOwner(viewer, target);
  }

  canViewComment(viewer: User, _target: Employee): boolean {
    return this.isAdmin(viewer) || this.isManager(viewer);
  }

  canEditComment(viewer: User, target: Employee): Promise<boolean> {
    return this.canEditEmployeeProfile(viewer, target);
  }

  canViewAdminComment(viewer: User): boolean {
    return this.isAdmin(viewer);
  }

  canEditAdminComment(viewer: User): boolean {
    return this.isAdmin(viewer);
  }

  canViewPersonalContacts(viewer: User, target?: Employee): boolean {
    if (this.isAdmin(viewer)) return true;
    if (target && this.isOwner(viewer, target)) return true;
    return false;
  }

  canEditPersonalContacts(viewer: User): boolean {
    return this.isAdmin(viewer);
  }

  canViewEmergencyContact(viewer: User): boolean {
    return this.isAdmin(viewer);
  }

  canEditEmergencyContact(viewer: User): boolean {
    return this.isAdmin(viewer);
  }

  canCreateEmployeeAccount(viewer: User, target: Employee): boolean {
    return this.isAdmin(viewer) && target.userId == null;
  }

  canManageExistingEmployeeAccount(viewer: User, target: Employee): boolean {
    return this.isAdmin(viewer) && target.userId != null;
  }

  /** Admin + target has account. Includes self (reset own password allowed). */
  canResetEmployeePassword(viewer: User, target: Employee): boolean {
    return this.isAdmin(viewer) && target.userId != null;
  }

  /**
   * Activate / deactivate / delete login account — not on self.
   * Reset password uses {@link canResetEmployeePassword} instead.
   */
  canDestructivelyManageAccount(actor: User, target: Employee): boolean {
    return (
      this.canManageExistingEmployeeAccount(actor, target) &&
      target.userId !== actor.id
    );
  }

  /** Hard-delete Employee operational aggregate — admin, not self. */
  canDeleteEmployee(actor: User, target: Employee): boolean {
    return this.isAdmin(actor) && target.userId !== actor.id;
  }

  async canExportProfilePdf(
    viewer: User,
    target: Employee,
  ): Promise<boolean> {
    if (!(this.isAdmin(viewer) || this.isManager(viewer))) return false;
    return this.canViewEmployeeProfile(viewer, target);
  }

  canViewVisibilityOverrides(viewer: User, _targetRole: string): boolean {
    return this.isAdmin(viewer);
  }

  canEditVisibilityOverrides(viewer: User, _targetRole: string): boolean {
    return this.isAdmin(viewer);
  }

  private static readonly EMPLOYEE_CARD_RELATIONS = [
    'department',
    'department.direction',
    'position',
    'position.direction',
    'user',
  ] as const;

  async listVisibleEmployees(actor: User): Promise<Employee[]> {
    if (this.scope(actor) === 'all') {
      return this.employees.find({
        relations: [...EmployeeAccessService.EMPLOYEE_CARD_RELATIONS],
        order: { lastName: 'ASC' },
      });
    }
    if (this.scope(actor) === 'self') {
      const self = await this.employees.findOne({
        where: { userId: actor.id },
        relations: [...EmployeeAccessService.EMPLOYEE_CARD_RELATIONS],
      });
      return self ? [self] : [];
    }
    const deptIds = await this.managedDepartmentIds(actor);
    if (!deptIds.length) {
      const self = await this.employees.findOne({
        where: { userId: actor.id },
        relations: [...EmployeeAccessService.EMPLOYEE_CARD_RELATIONS],
      });
      return self ? [self] : [];
    }
    return this.employees.find({
      where: { departmentId: In(deptIds) },
      relations: [...EmployeeAccessService.EMPLOYEE_CARD_RELATIONS],
      order: { lastName: 'ASC' },
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

  async managedDepartmentIds(actor: User): Promise<string[]> {
    const self = await this.employees.findOne({ where: { userId: actor.id } });
    if (!self) return [];
    const rows = await this.managed.find({ where: { employeeId: self.id } });
    return rows.map((r) => r.departmentId);
  }
}
