import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { DepartmentsService } from '../departments/departments.service';
import { PositionsService } from '../positions/positions.service';
import { EmployeeAccessService } from '../access/employee-access.service';
import { Employee } from './employee.entity';
import { WorkScheduleDay } from './work-schedule-day.entity';

export type EmployeeSummaryDto = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
};

export type CreateEmployeeInput = {
  firstName: string;
  lastName: string;
  departmentId?: string | null;
  positionId?: string | null;
};

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(WorkScheduleDay)
    private readonly schedules: Repository<WorkScheduleDay>,
    private readonly access: EmployeeAccessService,
    private readonly departments: DepartmentsService,
    private readonly positions: PositionsService,
  ) {}

  async findAll(actor: User): Promise<EmployeeSummaryDto[]> {
    const rows = await this.access.listVisibleEmployees(actor);
    return Promise.all(rows.map((e) => this.toSummary(e)));
  }

  async findOne(actor: User, id: string): Promise<EmployeeSummaryDto> {
    const emp = await this.access.getEmployeeOrFail(id);
    await this.access.requireCanView(actor, emp);
    return this.toSummary(emp);
  }

  async create(
    actor: User,
    dto: CreateEmployeeInput,
  ): Promise<EmployeeSummaryDto> {
    if (actor.role !== UserRole.Admin) {
      const probe = Object.assign(new Employee(), {
        departmentId: dto.departmentId ?? null,
      });
      await this.access.requireCanEdit(actor, probe);
    }

    if (dto.departmentId) await this.departments.getOrFail(dto.departmentId);
    if (dto.positionId) await this.positions.getOrFail(dto.positionId);

    const employeeNumber = await this.nextEmployeeNumber();
    const emp = await this.employees.save(
      this.employees.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        departmentId: dto.departmentId ?? null,
        positionId: dto.positionId ?? null,
        employeeNumber,
        role: UserRole.Employee,
        isActive: true,
      }),
    );
    return this.toSummary(emp);
  }

  findByUserId(userId: string): Promise<Employee | null> {
    return this.employees.findOne({ where: { userId } });
  }

  async getSchedule(
    actor: User,
    employeeId: string,
  ): Promise<WorkScheduleDay[]> {
    const emp = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, emp);
    return this.schedules.find({
      where: { employeeId },
      order: { weekday: 'ASC' },
    });
  }

  async replaceSchedule(
    actor: User,
    employeeId: string,
    days: Array<{
      weekday: number;
      startTime?: string | null;
      endTime?: string | null;
      isDayOff?: boolean;
    }>,
  ): Promise<WorkScheduleDay[]> {
    const emp = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanEdit(actor, emp);
    await this.schedules.delete({ employeeId });
    const rows = days.map((d) =>
      this.schedules.create({
        employeeId,
        weekday: d.weekday,
        startTime: d.startTime ?? null,
        endTime: d.endTime ?? null,
        isDayOff: d.isDayOff ?? false,
      }),
    );
    return this.schedules.save(rows);
  }

  private async nextEmployeeNumber(): Promise<string> {
    const count = await this.employees.count();
    return `E${String(count + 1).padStart(4, '0')}`;
  }

  private async toSummary(emp: Employee): Promise<EmployeeSummaryDto> {
    let department = null;
    let position = null;
    if (emp.departmentId) {
      try {
        const d = await this.departments.getOrFail(emp.departmentId);
        department = { id: d.id, name: d.name };
      } catch {
        department = null;
      }
    }
    if (emp.positionId) {
      try {
        const p = await this.positions.getOrFail(emp.positionId);
        position = { id: p.id, name: p.name };
      } catch {
        position = null;
      }
    }
    return {
      id: emp.id,
      employeeNumber: emp.employeeNumber,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department,
      position,
    };
  }
}
