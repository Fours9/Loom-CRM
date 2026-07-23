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

  async requireCanView(actor: User, target: Employee): Promise<void> {
    if (this.scope(actor) === 'all') return;
    if (target.userId === actor.id) return;
    if (this.scope(actor) === 'managed_departments') {
      const deptIds = await this.managedDepartmentIds(actor);
      if (target.departmentId && deptIds.includes(target.departmentId)) {
        return;
      }
    }
    throw new ForbiddenException('Cannot view employee');
  }

  async requireCanEdit(actor: User, target: Employee): Promise<void> {
    if (actor.role === UserRole.Admin) return;
    if (this.scope(actor) === 'managed_departments') {
      const deptIds = await this.managedDepartmentIds(actor);
      if (target.departmentId && deptIds.includes(target.departmentId)) {
        return;
      }
    }
    throw new ForbiddenException('Cannot edit employee');
  }

  async listVisibleEmployees(actor: User): Promise<Employee[]> {
    if (this.scope(actor) === 'all') {
      return this.employees.find({ order: { lastName: 'ASC' } });
    }
    if (this.scope(actor) === 'self') {
      const self = await this.employees.findOne({
        where: { userId: actor.id },
      });
      return self ? [self] : [];
    }
    const deptIds = await this.managedDepartmentIds(actor);
    if (!deptIds.length) {
      const self = await this.employees.findOne({
        where: { userId: actor.id },
      });
      return self ? [self] : [];
    }
    return this.employees.find({
      where: { departmentId: In(deptIds) },
      order: { lastName: 'ASC' },
    });
  }

  async getEmployeeOrFail(id: string): Promise<Employee> {
    const emp = await this.employees.findOne({ where: { id } });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  private async managedDepartmentIds(actor: User): Promise<string[]> {
    const self = await this.employees.findOne({ where: { userId: actor.id } });
    if (!self) return [];
    const rows = await this.managed.find({ where: { employeeId: self.id } });
    return rows.map((r) => r.departmentId);
  }
}
