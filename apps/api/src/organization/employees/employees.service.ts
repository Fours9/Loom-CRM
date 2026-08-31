import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole, UserStatus } from '../../platform/identity/user.enums';
import { UsersService } from '../../platform/identity/users.service';
import { DepartmentsService } from '../departments/departments.service';
import { PositionsService } from '../positions/positions.service';
import { EmployeeAccessService } from '../access/employee-access.service';
import { Employee } from './employee.entity';
import { WorkScheduleDay } from './work-schedule-day.entity';
import { EmployeeContact } from './employee-contact.entity';
import { EmploymentAssignment } from './employment-assignment.entity';
import { EmploymentAssignmentManagedDepartment } from './employment-assignment-managed-department.entity';
import { EmployeeSerializer } from './employee.serializer';
import { AuditService } from '../../platform/audit/audit.service';
import {
  buildProfileCompletenessFacts,
  computeProfileCompleteness,
} from './employee-profile-completeness';
import type { EmployeeListQueryDto } from './employee-list-query.dto';
import { pickLegacyOrgAssignmentPatch } from './legacy-org-assignment-patch';
import type { DisplayedDirectionRef } from './resolve-employee-displayed-direction';
import { IdentityRoleProjection } from './identity-role-projection';
import {
  loadPositionManagerTemplate,
  replaceAssignmentManagedDepartments,
  resolveManagerMembershipForCreate,
} from './managed-department-writes';
import { BusinessDateClock } from './business-date-clock';

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
  schedule: ScheduleDayInput[];
}>;

export type UpdateAccessSettingsInput = {
  adminAccess?: boolean;
  profileVisibilityOverride?: string | null;
  absenceVisibilityOverride?: string | null;
  showAbsenceTypeToPeersOverride?: boolean | string | null;
};

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(WorkScheduleDay)
    private readonly schedules: Repository<WorkScheduleDay>,
    @InjectRepository(EmployeeContact)
    private readonly contacts: Repository<EmployeeContact>,
    @InjectRepository(EmploymentAssignment)
    private readonly assignments: Repository<EmploymentAssignment>,
    @InjectRepository(EmploymentAssignmentManagedDepartment)
    private readonly eaManaged: Repository<EmploymentAssignmentManagedDepartment>,
    private readonly access: EmployeeAccessService,
    private readonly departments: DepartmentsService,
    private readonly positions: PositionsService,
    private readonly users: UsersService,
    private readonly serializer: EmployeeSerializer,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
    private readonly identityRoleProjection: IdentityRoleProjection,
    private readonly businessDateClock: BusinessDateClock,
  ) {}

  async findAll(actor: User, query: EmployeeListQueryDto = {}) {
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

    const { scoreById, assignmentDirectionByEmployee } =
      await this.batchCoreCompleteness(rows);

    if (query.maxCompleteness != null) {
      const max = query.maxCompleteness;
      rows = rows.filter((e) => (scoreById.get(e.id) ?? 0) <= max);
    }

    const dir = query.sortDir?.toLowerCase() === 'desc' ? -1 : 1;
    const key = (query.sortBy ?? 'fullName').toLowerCase();
    if (key === 'completeness') {
      rows.sort((a, b) => {
        const scoreDiff =
          (scoreById.get(a.id) ?? 0) - (scoreById.get(b.id) ?? 0);
        if (scoreDiff !== 0) return scoreDiff * dir;
        const nameDiff = this.serializer
          .fullName(a)
          .localeCompare(this.serializer.fullName(b), 'uk-UA');
        if (nameDiff !== 0) return nameDiff;
        return a.employeeNumber.localeCompare(b.employeeNumber);
      });
    } else {
      rows.sort((a, b) => {
        const av = this.sortValue(a, key);
        const bv = this.sortValue(b, key);
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }

    // After listVisibleEmployees, every row is in-scope → work contacts OK without per-row DB.
    return Promise.all(
      rows.map((e) =>
        this.serializer.toListDto(e, actor, {
          canViewWorkContacts: true,
          completenessPercent: scoreById.get(e.id) ?? 0,
          assignmentDirection: assignmentDirectionByEmployee.get(e.id) ?? null,
        }),
      ),
    );
  }

  /**
   * Core completeness only (parity with profile assignment resolution).
   * currentAssignmentId wins; active-by-employee only when currentAssignmentId is absent.
   */
  private async batchCoreCompleteness(rows: Employee[]): Promise<{
    scoreById: Map<string, number>;
    assignmentDirectionByEmployee: Map<string, DisplayedDirectionRef | null>;
  }> {
    const scoreById = new Map<string, number>();
    const assignmentDirectionByEmployee = new Map<
      string,
      DisplayedDirectionRef | null
    >();
    if (rows.length === 0) {
      return { scoreById, assignmentDirectionByEmployee };
    }

    const employeeIds = rows.map((e) => e.id);
    const currentIds = rows
      .map((e) => e.currentAssignmentId)
      .filter((id): id is string => Boolean(id));
    const withoutCurrent = rows
      .filter((e) => !e.currentAssignmentId)
      .map((e) => e.id);

    const [workContacts, currentAssignments, activeAssignments] =
      await Promise.all([
        this.contacts.find({
          where: {
            employeeId: In(employeeIds),
            type: In(['work_phone', 'work_email']),
          },
        }),
        currentIds.length
          ? this.assignments.find({
              where: { id: In(currentIds) },
              relations: ['direction'],
            })
          : Promise.resolve([] as EmploymentAssignment[]),
        withoutCurrent.length
          ? this.assignments.find({
              where: {
                employeeId: In(withoutCurrent),
                status: 'active',
              },
              relations: ['direction'],
            })
          : Promise.resolve([] as EmploymentAssignment[]),
      ]);

    const contactsByEmployee = new Map<string, EmployeeContact[]>();
    for (const c of workContacts) {
      const list = contactsByEmployee.get(c.employeeId) ?? [];
      list.push(c);
      contactsByEmployee.set(c.employeeId, list);
    }

    const assignmentByEmployee = new Map<string, EmploymentAssignment | null>();
    const currentById = new Map(currentAssignments.map((a) => [a.id, a]));
    for (const e of rows) {
      if (e.currentAssignmentId) {
        assignmentByEmployee.set(
          e.id,
          currentById.get(e.currentAssignmentId) ?? null,
        );
      }
    }
    for (const a of activeAssignments) {
      if (!assignmentByEmployee.has(a.employeeId)) {
        assignmentByEmployee.set(a.employeeId, a);
      }
    }

    for (const e of rows) {
      const assignment = assignmentByEmployee.get(e.id) ?? null;
      assignmentDirectionByEmployee.set(
        e.id,
        assignment?.directionId
          ? {
              id: assignment.directionId,
              name: assignment.direction?.name ?? null,
            }
          : null,
      );
      const scored = computeProfileCompleteness(
        buildProfileCompletenessFacts({
          employee: e,
          contacts: contactsByEmployee.get(e.id) ?? [],
          emergencyCount: 0,
          importantDatesCount: 0,
          assignment: assignment
            ? {
                status: assignment.status,
                departmentId: assignment.departmentId,
                positionId: assignment.positionId,
                startDate: assignment.startDate,
              }
            : null,
        }),
      );
      scoreById.set(e.id, scored.core.percent);
    }

    return { scoreById, assignmentDirectionByEmployee };
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

    const activeEa = await this.assignments.findOne({
      where: { employeeId: id, status: 'active' },
      order: { startDate: 'DESC', id: 'DESC' },
    });
    let managedDepartmentIds: string[] = [];
    let managedDepartments: { id: string; name: string | null }[] = [];
    if (activeEa?.isDepartmentManager) {
      const managed = await this.eaManaged.find({
        where: { assignmentId: activeEa.id },
      });
      managedDepartmentIds = managed.map((m) => m.departmentId);
      managedDepartments = await Promise.all(
        managed.map(async (m) => {
          try {
            const d = await this.departments.getOrFail(m.departmentId);
            return { id: m.departmentId, name: d.name };
          } catch {
            return { id: m.departmentId, name: null as string | null };
          }
        }),
      );
    }

    const assignmentDirection = await this.resolveAssignmentDirection(employee);

    return {
      ...(await this.serializer.toDetailDto(employee, actor, {
        assignmentDirection,
      })),
      schedule: schedule.map((day) => this.toScheduleDto(day)),
      managedDepartmentIds,
      managedDepartments,
      isDepartmentManager: Boolean(activeEa?.isDepartmentManager),
      adminAccess: employee.role === UserRole.Admin,
      computedRole:
        employee.role === UserRole.Admin
          ? activeEa?.isDepartmentManager
            ? UserRole.DepartmentManager
            : UserRole.Employee
          : employee.role,
      profileVisibilityOverride: employee.profileVisibilityOverride,
      absenceVisibilityOverride: employee.absenceVisibilityOverride,
      showAbsenceTypeToPeersOverride: this.peerTypeOverrideFromColumn(
        employee.showAbsenceTypeToPeersOverride,
      ),
      requestsPlaceholder: [] as unknown[],
      permissions: await this.serializer.buildDetailPermissions(
        actor,
        employee,
      ),
    };
  }

  private async resolveAssignmentDirection(
    employee: Employee,
  ): Promise<DisplayedDirectionRef | null> {
    let assignment: EmploymentAssignment | null = null;
    if (employee.currentAssignmentId) {
      assignment = await this.assignments.findOne({
        where: { id: employee.currentAssignmentId },
        relations: ['direction'],
      });
      if (
        !assignment ||
        assignment.employeeId !== employee.id ||
        assignment.status !== 'active'
      ) {
        assignment = null;
      }
    }
    if (!assignment) {
      assignment =
        (await this.assignments
          .createQueryBuilder('ea')
          .leftJoinAndSelect('ea.direction', 'direction')
          .where('ea.employee_id = :employeeId', { employeeId: employee.id })
          .andWhere('ea.status = :status', { status: 'active' })
          .orderBy('ea.start_date', 'DESC', 'NULLS LAST')
          .addOrderBy('ea.id', 'DESC')
          .getOne()) ?? null;
    }
    if (!assignment?.directionId) return null;
    return {
      id: assignment.directionId,
      name: assignment.direction?.name ?? null,
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
      calendarColor?: string | null;
      phoneNumber?: string | null;
      telegram?: string | null;
      workEmail?: string | null;
      personalPhoneNumber?: string | null;
      personalTelegram?: string | null;
      personalEmail?: string | null;
      createAccount?: boolean;
      email?: string;
      temporaryPassword?: string;
      profileVisibilityOverride?: string | null;
      absenceVisibilityOverride?: string | null;
      showAbsenceTypeToPeersOverride?: boolean | null;
      schedule?: ScheduleDayInput[];
    },
  ) {
    if (!this.access.isAdmin(actor)) {
      throw new ForbiddenException();
    }
    const departmentId = this.optionalUuid(dto.departmentId);
    const positionId = this.optionalUuid(dto.positionId);
    if (departmentId) await this.departments.getOrFail(departmentId);
    if (positionId) await this.positions.getOrFail(positionId);

    // Derive prefix from Position template before create (no manual role)
    let prefixRole: UserRole = UserRole.Employee;
    if (positionId) {
      const pos = await this.positions.getOrFail(positionId);
      if (pos.isDepartmentManagerTemplate) {
        prefixRole = UserRole.DepartmentManager;
      }
    }
    const employeeNumber =
      dto.employeeNumber?.trim() ||
      (await this.previewNextEmployeeNumber(actor, prefixRole)).employeeNumber;

    const createdId = await this.dataSource.transaction(async (manager) => {
      const employeeRepo = manager.getRepository(Employee);
      const assignmentRepo = manager.getRepository(EmploymentAssignment);

      const emp = await employeeRepo.save(
        employeeRepo.create({
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          middleName: dto.middleName?.trim() || null,
          departmentId,
          positionId,
          employeeNumber,
          role: UserRole.Employee,
          userId: null,
          calendarColor: dto.calendarColor ?? null,
          phoneNumber: dto.phoneNumber ?? null,
          telegram: dto.telegram ?? null,
          workEmail: dto.workEmail ?? null,
          personalPhoneNumber: dto.personalPhoneNumber ?? null,
          personalTelegram: dto.personalTelegram ?? null,
          personalEmail: dto.personalEmail ?? null,
          isDepartmentManager: false,
          profileVisibilityOverride: dto.profileVisibilityOverride ?? null,
          absenceVisibilityOverride: dto.absenceVisibilityOverride ?? null,
          showAbsenceTypeToPeersOverride: this.peerTypeOverrideToColumn(
            dto.showAbsenceTypeToPeersOverride,
          ),
          isActive: true,
        }),
      );

      const { position, managedDepartmentIds: templateDepts } =
        await loadPositionManagerTemplate(manager, positionId);
      const membership = resolveManagerMembershipForCreate({
        position,
        positionManagedDepartmentIds: templateDepts,
        assignmentDepartmentId: departmentId,
      });

      let companyId: string | null = null;
      let directionId: string | null = null;
      if (departmentId) {
        const dept = await this.departments.getOrFail(departmentId);
        directionId = dept.directionId ?? null;
        // company via direction if available — leave null if unknown
      }

      const today = this.businessDateClock.today();
      const assignment = await assignmentRepo.save(
        assignmentRepo.create({
          employeeId: emp.id,
          companyId,
          directionId,
          departmentId,
          positionId,
          status: 'active',
          startDate: today,
          isDepartmentManager: membership.isDepartmentManager,
          createdByUserId: actor.id,
        }),
      );
      await replaceAssignmentManagedDepartments(
        manager,
        assignment.id,
        membership.managedDepartmentIds,
      );

      emp.currentAssignmentId = assignment.id;
      emp.departmentId = assignment.departmentId;
      emp.positionId = assignment.positionId;
      await employeeRepo.save(emp);

      await this.identityRoleProjection.apply(manager, emp, {
        adminAccess: 'preserve',
      });

      if (dto.createAccount) {
        if (!dto.email || !dto.temporaryPassword) {
          throw new BadRequestException(
            'email and temporaryPassword are required when createAccount=true',
          );
        }
        const email = dto.email.toLowerCase().trim();
        const existing = await manager.getRepository(User).findOne({
          where: { email },
        });
        if (existing) {
          throw new ConflictException('Email already in use');
        }
        const fresh = await employeeRepo.findOneOrFail({ where: { id: emp.id } });
        const userRepo = manager.getRepository(User);
        const user = await userRepo.save(
          userRepo.create({
            email,
            passwordHash: await bcrypt.hash(dto.temporaryPassword, 12),
            role: fresh.role as UserRole,
            isDepartmentManager: false,
            status: UserStatus.Active,
            mustChangePassword: true,
            tokenVersion: 0,
            passwordChangedAt: null,
            lastLoginAt: null,
          }),
        );
        fresh.userId = user.id;
        await employeeRepo.save(fresh);
      }

      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.created',
          entityType: 'Employee',
          entityId: emp.id,
          metadata: { employeeNumber: emp.employeeNumber },
        },
        manager,
      );

      return emp.id;
    });

    if (dto.schedule?.length === 7) {
      await this.replaceScheduleInternal(createdId, dto.schedule);
    } else {
      await this.replaceScheduleInternal(createdId, this.defaultSchedule());
    }

    return this.findOne(actor, createdId);
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
    // Legacy org patch: display mirror only — Access SoT is active EA.
    // Prefer EA writer; Absences should be read-only for dept/position.
    const orgPatch = pickLegacyOrgAssignmentPatch(actor, dto);
    if (orgPatch.departmentId !== undefined) {
      const departmentId = this.optionalUuid(orgPatch.departmentId);
      if (departmentId) await this.departments.getOrFail(departmentId);
      employee.departmentId = departmentId;
    }
    if (orgPatch.positionId !== undefined) {
      const positionId = this.optionalUuid(orgPatch.positionId);
      if (positionId) await this.positions.getOrFail(positionId);
      employee.positionId = positionId;
    }
    if (dto.calendarColor !== undefined)
      employee.calendarColor = dto.calendarColor;
    if (dto.phoneNumber !== undefined) employee.phoneNumber = dto.phoneNumber;
    if (dto.telegram !== undefined) employee.telegram = dto.telegram;
    if (dto.workEmail !== undefined) employee.workEmail = dto.workEmail;
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

  async updateAccessSettings(
    actor: User,
    id: string,
    dto: UpdateAccessSettingsInput,
  ) {
    if (!this.access.isAdmin(actor)) {
      throw new ForbiddenException();
    }
    await this.access.getEmployeeOrFail(id);

    await this.dataSource.transaction(async (manager) => {
      const employeeRepo = manager.getRepository(Employee);
      const emp = await employeeRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!emp) throw new NotFoundException('Employee not found');

      const before = {
        role: emp.role,
        profileVisibilityOverride: emp.profileVisibilityOverride,
        absenceVisibilityOverride: emp.absenceVisibilityOverride,
        showAbsenceTypeToPeersOverride: emp.showAbsenceTypeToPeersOverride,
      };

      if (
        dto.profileVisibilityOverride !== undefined &&
        this.access.canEditVisibilityOverrides(actor, emp.role)
      ) {
        emp.profileVisibilityOverride = dto.profileVisibilityOverride;
      }
      if (
        dto.absenceVisibilityOverride !== undefined &&
        this.access.canEditVisibilityOverrides(actor, emp.role)
      ) {
        emp.absenceVisibilityOverride = dto.absenceVisibilityOverride;
      }
      if (
        dto.showAbsenceTypeToPeersOverride !== undefined &&
        this.access.canEditVisibilityOverrides(actor, emp.role)
      ) {
        emp.showAbsenceTypeToPeersOverride = this.peerTypeOverrideToColumn(
          dto.showAbsenceTypeToPeersOverride,
        );
      }
      await employeeRepo.save(emp);

      if (dto.adminAccess !== undefined) {
        await this.identityRoleProjection.apply(manager, emp, {
          adminAccess: dto.adminAccess,
        });
      }

      const after = await employeeRepo.findOneOrFail({ where: { id } });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.access_settings_updated',
          entityType: 'Employee',
          entityId: id,
          metadata: {
            before,
            after: {
              role: after.role,
              profileVisibilityOverride: after.profileVisibilityOverride,
              absenceVisibilityOverride: after.absenceVisibilityOverride,
              showAbsenceTypeToPeersOverride:
                after.showAbsenceTypeToPeersOverride,
            },
          },
        },
        manager,
      );
    });

    return this.findOne(actor, id);
  }

  async updateAccountEmail(actor: User, id: string, email: string) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!this.access.canEditAccountEmail(actor, employee)) {
      throw new ForbiddenException();
    }
    if (!employee.userId) throw new BadRequestException('No account');
    const normalized = email.toLowerCase().trim();
    if (!normalized) throw new BadRequestException('Email required');
    const existing = await this.users.findByEmail(normalized);
    if (existing && existing.id !== employee.userId) {
      throw new ConflictException('Email already in use');
    }
    const user = await this.users.getByIdOrFail(employee.userId);
    const before = user.email;
    user.email = normalized;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await this.users.save(user);
    await this.audit.record({
      actorId: actor.id,
      action: 'employee.account_email_updated',
      entityType: 'Employee',
      entityId: id,
      metadata: { before, after: normalized },
    });
    return this.findOne(actor, id);
  }

  async previewNextEmployeeNumber(actor: User, role?: UserRole) {
    if (!this.access.isAdmin(actor)) throw new ForbiddenException();
    const effective = role ?? UserRole.Employee;
    const prefix =
      effective === UserRole.Admin
        ? 'A'
        : effective === UserRole.DepartmentManager
          ? 'M'
          : 'E';
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

  async previewNextEmployeeNumberFromPosition(
    actor: User,
    positionId?: string | null,
  ) {
    let role: UserRole = UserRole.Employee;
    if (positionId) {
      try {
        const pos = await this.positions.getOrFail(positionId);
        if (pos.isDepartmentManagerTemplate) {
          role = UserRole.DepartmentManager;
        }
      } catch {
        /* ignore invalid position for preview */
      }
    }
    return this.previewNextEmployeeNumber(actor, role);
  }

  async attachAccount(
    actor: User,
    id: string,
    dto: { email: string; temporaryPassword: string },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!this.access.canCreateEmployeeAccount(actor, employee)) {
      throw new ForbiddenException();
    }
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('Email already in use');
    }

    await this.dataSource.transaction(async (manager) => {
      const employeeRepo = manager.getRepository(Employee);
      const emp = await employeeRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!emp) throw new NotFoundException('Employee not found');

      await this.identityRoleProjection.apply(manager, emp, {
        adminAccess: 'preserve',
      });
      const fresh = await employeeRepo.findOneOrFail({ where: { id } });

      const userRepo = manager.getRepository(User);
      const user = await userRepo.save(
        userRepo.create({
          email,
          passwordHash: await bcrypt.hash(dto.temporaryPassword, 12),
          role: fresh.role as UserRole,
          isDepartmentManager: false,
          status: UserStatus.Active,
          mustChangePassword: true,
          tokenVersion: 0,
          passwordChangedAt: null,
          lastLoginAt: null,
        }),
      );
      fresh.userId = user.id;
      await employeeRepo.save(fresh);
    });

    return this.findOne(actor, id);
  }

  async updateAccountStatus(
    actor: User,
    id: string,
    status: 'active' | 'deactivated',
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!this.access.canDestructivelyManageAccount(actor, employee)) {
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
    if (!this.access.canDestructivelyManageAccount(actor, employee)) {
      throw new ForbiddenException();
    }
    if (!employee.userId) throw new BadRequestException('No account');
    const userId = employee.userId;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Employee).update({ id }, { userId: null });
      await this.users.deleteById(userId, manager);
    });
    return this.findOne(actor, id);
  }

  findByUserId(userId: string): Promise<Employee | null> {
    return this.employees.findOne({ where: { userId } });
  }

  async getSchedule(actor: User, employeeId: string) {
    const emp = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, emp);
    return this.getScheduleDaysInternal(employeeId);
  }

  /**
   * Internal schedule flags for Absences/TimeEvent SchedulePolicy.
   * Does not enforce viewer ACL — caller must already authorize the employee.
   */
  async getScheduleDaysInternal(employeeId: string) {
    const days = await this.schedules.find({
      where: { employeeId },
      order: { weekday: 'ASC' },
    });
    if (days.length === 0) {
      return this.defaultSchedule().map((d) => ({
        weekday: d.weekday,
        isWorkingDay: Boolean(d.isWorkingDay),
        startTime: d.startTime ?? null,
        endTime: d.endTime ?? null,
        breakStart: d.breakStart ?? null,
        breakEnd: d.breakEnd ?? null,
        note: d.note ?? null,
      }));
    }
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

  /** Persist Absences FE boolean override into text column; pass-through strings. */
  private peerTypeOverrideToColumn(
    value: boolean | string | null | undefined,
  ): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed === 'true' || trimmed === 'false') return trimmed;
    return trimmed;
  }

  private peerTypeOverrideFromColumn(
    value: string | null | undefined,
  ): boolean | null {
    if (value == null || value === '') return null;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return null;
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
            ? !d.isDayOff
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
