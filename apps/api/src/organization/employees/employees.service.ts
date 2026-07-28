import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole, UserStatus } from '../../platform/identity/user.enums';
import { UsersService } from '../../platform/identity/users.service';
import { DepartmentsService } from '../departments/departments.service';
import { PositionsService } from '../positions/positions.service';
import { EmployeeAccessService } from '../access/employee-access.service';
import { Employee } from './employee.entity';
import { WorkScheduleDay } from './work-schedule-day.entity';
import { EmployeeManagedDepartment } from './employee-managed-department.entity';
import { EmployeeSerializer } from './employee.serializer';
import { AuditService } from '../../platform/audit/audit.service';

export type ScheduleDayInput = {
  weekday: number;
  isWorkingDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  note?: string | null;
  isDayOff?: boolean;
};

export type UpdateEmployeeInput = Partial<{
  firstName: string;
  lastName: string;
  middleName: string | null;
  employeeNumber: string;
  departmentId: string | null;
  positionId: string | null;
  calendarColor: string | null;
  phoneNumber: string | null;
  telegram: string | null;
  workEmail: string | null;
  personalPhoneNumber: string | null;
  personalTelegram: string | null;
  personalEmail: string | null;
  comment: string | null;
  adminComment: string | null;
  role: UserRole;
  isDepartmentManager: boolean;
  profileVisibilityOverride: string | null;
  absenceVisibilityOverride: string | null;
  showAbsenceTypeToPeersOverride: string | null;
  schedule: ScheduleDayInput[];
}>;

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(WorkScheduleDay)
    private readonly schedules: Repository<WorkScheduleDay>,
    @InjectRepository(EmployeeManagedDepartment)
    private readonly managed: Repository<EmployeeManagedDepartment>,
    private readonly access: EmployeeAccessService,
    private readonly departments: DepartmentsService,
    private readonly positions: PositionsService,
    private readonly users: UsersService,
    private readonly serializer: EmployeeSerializer,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    actor: User,
    query: {
      q?: string;
      departmentId?: string;
      departmentIds?: string[];
      positionId?: string;
      status?: string;
      sortBy?: string;
      sortDir?: string;
    } = {},
  ) {
    let rows = await this.access.listVisibleEmployees(actor);

    const deptIds = [
      ...new Set(
        [
          ...(query.departmentIds ?? []),
          ...(query.departmentId ? [query.departmentId] : []),
        ].filter(Boolean),
      ),
    ];
    if (deptIds.length) {
      rows = rows.filter(
        (e) => e.departmentId && deptIds.includes(e.departmentId),
      );
    }
    if (query.positionId) {
      rows = rows.filter((e) => e.positionId === query.positionId);
    }
    if (query.q?.trim()) {
      const q = query.q.trim().toLowerCase();
      rows = rows.filter((e) => {
        const hay = [
          e.lastName,
          e.firstName,
          e.middleName,
          e.employeeNumber,
          e.workEmail,
          e.user?.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (query.status === 'active') {
      rows = rows.filter(
        (e) => !e.userId || e.user?.status === UserStatus.Active,
      );
    } else if (query.status === 'deactivated') {
      rows = rows.filter((e) => e.user?.status === UserStatus.Deactivated);
    } else if (query.status === 'no_account') {
      rows = rows.filter((e) => !e.userId);
    }

    const dir = query.sortDir?.toLowerCase() === 'desc' ? -1 : 1;
    const key = (query.sortBy ?? 'fullName').toLowerCase();
    rows.sort((a, b) => {
      const av = this.sortValue(a, key);
      const bv = this.sortValue(b, key);
      return av < bv ? -dir : av > bv ? dir : 0;
    });

    return Promise.all(rows.map((e) => this.serializer.toListDto(e, actor)));
  }

  async findOne(actor: User, id: string) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!(await this.access.canViewEmployeeProfile(actor, employee))) {
      throw new NotFoundException('Employee not found');
    }
    const schedule = await this.schedules.find({
      where: { employeeId: id },
      order: { weekday: 'ASC' },
    });
    const managed = await this.managed.find({ where: { employeeId: id } });
    const managedDepartments = await Promise.all(
      managed.map(async (m) => {
        try {
          const d = await this.departments.getOrFail(m.departmentId);
          return { id: m.departmentId, name: d.name };
        } catch {
          return { id: m.departmentId, name: null as string | null };
        }
      }),
    );

    return {
      ...(await this.serializer.toDetailDto(employee, actor)),
      schedule: schedule.map((day) => this.toScheduleDto(day)),
      managedDepartmentIds: managed.map((m) => m.departmentId),
      managedDepartments,
      profileVisibilityOverride: employee.profileVisibilityOverride,
      absenceVisibilityOverride: employee.absenceVisibilityOverride,
      showAbsenceTypeToPeersOverride: employee.showAbsenceTypeToPeersOverride,
      requestsPlaceholder: [] as unknown[],
      permissions: await this.serializer.buildDetailPermissions(
        actor,
        employee,
      ),
    };
  }

  async create(
    actor: User,
    dto: {
      firstName: string;
      lastName: string;
      middleName?: string | null;
      departmentId?: string | null;
      positionId?: string | null;
      employeeNumber?: string;
      role?: UserRole;
      calendarColor?: string | null;
      phoneNumber?: string | null;
      telegram?: string | null;
      workEmail?: string | null;
      createAccount?: boolean;
      email?: string;
      temporaryPassword?: string;
      schedule?: ScheduleDayInput[];
    },
  ) {
    if (!this.access.isAdmin(actor)) {
      throw new ForbiddenException();
    }
    if (dto.departmentId) await this.departments.getOrFail(dto.departmentId);
    if (dto.positionId) await this.positions.getOrFail(dto.positionId);

    const role = dto.role ?? UserRole.Employee;
    const employeeNumber =
      dto.employeeNumber?.trim() ||
      (await this.previewNextEmployeeNumber(actor, role)).employeeNumber;

    let userId: string | null = null;
    if (dto.createAccount) {
      if (!dto.email || !dto.temporaryPassword) {
        throw new BadRequestException(
          'email and temporaryPassword are required when createAccount=true',
        );
      }
      const email = dto.email.toLowerCase().trim();
      if (await this.users.findByEmail(email)) {
        throw new ConflictException('Email already in use');
      }
      const user = await this.users.createUser({
        email,
        passwordHash: await bcrypt.hash(dto.temporaryPassword, 12),
        role,
        mustChangePassword: true,
      });
      userId = user.id;
    }

    const emp = await this.employees.save(
      this.employees.create({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        middleName: dto.middleName?.trim() || null,
        departmentId: this.optionalUuid(dto.departmentId),
        positionId: this.optionalUuid(dto.positionId),
        employeeNumber,
        role,
        userId,
        calendarColor: dto.calendarColor ?? null,
        phoneNumber: dto.phoneNumber ?? null,
        telegram: dto.telegram ?? null,
        workEmail: dto.workEmail ?? null,
        isActive: true,
      }),
    );

    if (dto.schedule?.length === 7) {
      await this.replaceScheduleInternal(emp.id, dto.schedule);
    } else {
      await this.replaceScheduleInternal(emp.id, this.defaultSchedule());
    }

    await this.audit.record({
      actorId: actor.id,
      action: 'employee.created',
      entityType: 'Employee',
      entityId: emp.id,
      metadata: { employeeNumber: emp.employeeNumber },
    });

    return this.findOne(actor, emp.id);
  }

  async update(actor: User, id: string, dto: UpdateEmployeeInput) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!(await this.access.canEditEmployeeProfile(actor, employee))) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.firstName !== undefined) employee.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) employee.lastName = dto.lastName.trim();
    if (dto.middleName !== undefined)
      employee.middleName = dto.middleName?.trim() || null;
    if (dto.employeeNumber !== undefined && this.access.isAdmin(actor)) {
      employee.employeeNumber = dto.employeeNumber.trim();
    }
    if (dto.departmentId !== undefined) {
      const departmentId = this.optionalUuid(dto.departmentId);
      if (departmentId) await this.departments.getOrFail(departmentId);
      employee.departmentId = departmentId;
    }
    if (dto.positionId !== undefined) {
      const positionId = this.optionalUuid(dto.positionId);
      if (positionId) await this.positions.getOrFail(positionId);
      employee.positionId = positionId;
    }
    if (dto.calendarColor !== undefined)
      employee.calendarColor = dto.calendarColor;
    if (dto.phoneNumber !== undefined) employee.phoneNumber = dto.phoneNumber;
    if (dto.telegram !== undefined) employee.telegram = dto.telegram;
    if (dto.workEmail !== undefined) employee.workEmail = dto.workEmail;
    if (dto.role !== undefined && this.access.isAdmin(actor))
      employee.role = dto.role;
    if (dto.isDepartmentManager !== undefined && this.access.isAdmin(actor)) {
      employee.isDepartmentManager = dto.isDepartmentManager;
    }
    if (
      dto.personalPhoneNumber !== undefined &&
      this.access.canEditPersonalContacts(actor)
    ) {
      employee.personalPhoneNumber = dto.personalPhoneNumber;
    }
    if (
      dto.personalTelegram !== undefined &&
      this.access.canEditPersonalContacts(actor)
    ) {
      employee.personalTelegram = dto.personalTelegram;
    }
    if (
      dto.personalEmail !== undefined &&
      this.access.canEditPersonalContacts(actor)
    ) {
      employee.personalEmail = dto.personalEmail;
    }
    if (
      dto.comment !== undefined &&
      (await this.access.canEditComment(actor, employee))
    ) {
      employee.comment = dto.comment;
    }
    if (
      dto.adminComment !== undefined &&
      this.access.canEditAdminComment(actor)
    ) {
      employee.adminComment = dto.adminComment;
    }
    if (
      dto.profileVisibilityOverride !== undefined &&
      this.access.canEditVisibilityOverrides(actor, employee.role)
    ) {
      employee.profileVisibilityOverride = dto.profileVisibilityOverride;
    }
    if (
      dto.absenceVisibilityOverride !== undefined &&
      this.access.canEditVisibilityOverrides(actor, employee.role)
    ) {
      employee.absenceVisibilityOverride = dto.absenceVisibilityOverride;
    }
    if (
      dto.showAbsenceTypeToPeersOverride !== undefined &&
      this.access.canEditVisibilityOverrides(actor, employee.role)
    ) {
      employee.showAbsenceTypeToPeersOverride =
        dto.showAbsenceTypeToPeersOverride;
    }

    await this.employees.save(employee);

    if (dto.schedule?.length === 7) {
      await this.replaceScheduleInternal(id, dto.schedule);
    }

    await this.audit.record({
      actorId: actor.id,
      action: 'employee.basic_updated',
      entityType: 'Employee',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return this.findOne(actor, id);
  }

  async previewNextEmployeeNumber(actor: User, role: UserRole) {
    if (!this.access.isAdmin(actor)) throw new ForbiddenException();
    const prefix =
      role === UserRole.Admin ? 'A' : role === UserRole.DepartmentManager ? 'M' : 'E';
    const rows = await this.employees
      .createQueryBuilder('e')
      .select('e.employee_number', 'employeeNumber')
      .where('e.employee_number LIKE :pattern', { pattern: `${prefix}-%` })
      .getRawMany<{ employeeNumber: string }>();
    let max = 0;
    for (const row of rows) {
      const m = String(row.employeeNumber).match(new RegExp(`^${prefix}-(\\d+)$`));
      if (m) max = Math.max(max, Number(m[1]));
    }
    return { employeeNumber: `${prefix}-${String(max + 1).padStart(3, '0')}` };
  }

  async attachAccount(
    actor: User,
    id: string,
    dto: { email: string; temporaryPassword: string; role?: UserRole },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!this.access.canCreateEmployeeAccount(actor, employee)) {
      throw new ForbiddenException();
    }
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('Email already in use');
    }
    const role = dto.role ?? employee.role;
    const user = await this.users.createUser({
      email,
      passwordHash: await bcrypt.hash(dto.temporaryPassword, 12),
      role,
      mustChangePassword: true,
    });
    employee.userId = user.id;
    employee.role = role;
    await this.employees.save(employee);
    return this.findOne(actor, id);
  }

  async updateAccountStatus(
    actor: User,
    id: string,
    status: 'active' | 'deactivated',
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!this.access.canManageExistingEmployeeAccount(actor, employee)) {
      throw new ForbiddenException();
    }
    if (!employee.userId) throw new BadRequestException('No account');
    const user = await this.users.findById(employee.userId);
    if (!user) throw new NotFoundException('User not found');
    user.status =
      status === 'deactivated' ? UserStatus.Deactivated : UserStatus.Active;
    await this.users.save(user);
    return this.findOne(actor, id);
  }

  async deleteAccount(actor: User, id: string) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!this.access.canManageExistingEmployeeAccount(actor, employee)) {
      throw new ForbiddenException();
    }
    if (!employee.userId) throw new BadRequestException('No account');
    const userId = employee.userId;
    employee.userId = null;
    await this.employees.save(employee);
    await this.users.deleteById(userId);
    return this.findOne(actor, id);
  }

  findByUserId(userId: string): Promise<Employee | null> {
    return this.employees.findOne({ where: { userId } });
  }

  async getSchedule(actor: User, employeeId: string) {
    const emp = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, emp);
    const days = await this.schedules.find({
      where: { employeeId },
      order: { weekday: 'ASC' },
    });
    return days.map((d) => this.toScheduleDto(d));
  }

  async replaceSchedule(
    actor: User,
    employeeId: string,
    days: ScheduleDayInput[],
  ) {
    const emp = await this.access.getEmployeeOrFail(employeeId);
    if (!(await this.access.canEditEmployeeSchedule(actor, emp))) {
      throw new NotFoundException('Employee not found');
    }
    if (days.length !== 7) {
      throw new BadRequestException('Schedule must contain 7 days');
    }
    await this.replaceScheduleInternal(employeeId, days);
    return this.getSchedule(actor, employeeId);
  }

  private async replaceScheduleInternal(
    employeeId: string,
    days: ScheduleDayInput[],
  ) {
    await this.schedules.delete({ employeeId });
    const rows = days.map((d) => {
      const isWorkingDay =
        d.isWorkingDay !== undefined
          ? Boolean(d.isWorkingDay)
          : d.isDayOff !== undefined
            ? !Boolean(d.isDayOff)
            : true;
      return this.schedules.create({
        employeeId,
        weekday: d.weekday,
        isWorkingDay,
        isDayOff: !isWorkingDay,
        startTime: d.startTime ?? null,
        endTime: d.endTime ?? null,
        breakStart: d.breakStart ?? null,
        breakEnd: d.breakEnd ?? null,
        note: d.note ?? null,
      });
    });
    await this.schedules.save(rows);
  }

  private defaultSchedule(): ScheduleDayInput[] {
    return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const isWorkingDay = weekday <= 5;
      return {
        weekday,
        isWorkingDay,
        startTime: isWorkingDay ? '09:00' : null,
        endTime: isWorkingDay ? '18:00' : null,
        breakStart: isWorkingDay ? '13:00' : null,
        breakEnd: isWorkingDay ? '14:00' : null,
        note: null,
      };
    });
  }

  private toScheduleDto(day: WorkScheduleDay) {
    return {
      weekday: day.weekday,
      isWorkingDay: Boolean(day.isWorkingDay),
      startTime: day.startTime,
      endTime: day.endTime,
      breakStart: day.breakStart,
      breakEnd: day.breakEnd,
      note: day.note,
    };
  }

  private sortValue(e: Employee, key: string): string {
    switch (key) {
      case 'employeenumber':
      case 'number':
        return e.employeeNumber.toLowerCase();
      case 'department':
      case 'departmentname':
        return (e.department?.name ?? '').toLowerCase();
      case 'position':
      case 'positionname':
        return (e.position?.name ?? '').toLowerCase();
      case 'role':
        return e.role;
      case 'status':
        return e.user?.status ?? 'no_account';
      default:
        return this.serializer.fullName(e).toLowerCase();
    }
  }

  /** Empty / whitespace optional UUID fields → null (department & position are optional). */
  private optionalUuid(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
