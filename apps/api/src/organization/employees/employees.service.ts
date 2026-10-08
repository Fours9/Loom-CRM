import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, In, Repository, EntityManager } from 'typeorm';
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
import {
  resolveEmployeeDisplayedDirection,
  type DisplayedDirectionRef,
} from './resolve-employee-displayed-direction';
import { selectCurrentEmploymentAssignment } from '../employment-catalog/current-employment-assignment.resolver';
import {
  compareEmployeeDirectoryLabels,
  resolveEmployeeListRoleLabel,
  resolveEmployeeListStatusLabel,
  unionIdLists,
} from './employee-list-labels';
import { IdentityRoleProjection } from './identity-role-projection';
import {
  loadPositionManagerTemplate,
  replaceAssignmentManagedDepartments,
  resolveManagerMembershipForCreate,
} from './managed-department-writes';
import { BusinessDateClock } from './business-date-clock';
import { resolveSystemAccountRoleId } from '../../platform/access-control/resolve-system-account-role-id';
import { AccountRole } from '../../platform/access-control/account-role.entity';
import { LastAdminPolicy } from '../../platform/access-control/last-admin.policy';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import {
  SystemAccountRoleCode,
} from '../../platform/access-control/system-account-role-codes';
import { userRoleMirrorFor } from '../../platform/access-control/account-role-mirror';
import {
  compatibilityUserRoleFromAccountRole,
} from './identity-role-projection';
import {
  ManagementKind,
  isManagementKind,
} from '../employment-catalog/management-kind';
import { defaultSystemAccountRoleCodeFromLeadership } from '@loom/contracts-access-control';
import type { EmploymentManagementKind } from '@loom/contracts-employees';
import { Permission } from '../../platform/permissions/permission.names';
import {
  hasPermission,
  type AuthorizationContext,
} from '../../platform/access-control/authorization-context';
import type { ActorAccessContext } from '../access/employee-access.service';
import { CreateEmployeeDto } from './create-employee.dto';
import { EmployeeContactsFacade } from './employee-contacts.facade';
import {
  EmployeeNumberAllocator,
  employeeNumberPrefixFromMembership,
  employeeNumberPrefixForCreate,
} from './employee-number.allocator';
import {
  EmploymentAssignmentOrganizationResolver,
  rethrowAssignmentWriteError,
} from './employment-assignment-organization.resolver';
import type { PersonalContactWriteInput } from './employee-personal-contacts';
import { canAssignAccountRole } from './employee-account-role-assign.policy';
import { canCreateAccountAtEmployeeCreate } from './employee-profile-authz';
import type { CreateEmployeeResponse } from '@loom/contracts-employees';

type DisplayedOrgProjection = {
  displayedDirection: {
    directionId: string | null;
    directionName: string | null;
  };
  selectedAssignment: EmploymentAssignment | null;
};

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
  accountRoleId?: string;
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
    private readonly lastAdmin: LastAdminPolicy,
    private readonly authorization: AuthorizationContextService,
    private readonly contactsFacade: EmployeeContactsFacade,
    private readonly numberAllocator: EmployeeNumberAllocator,
    private readonly assignmentOrg: EmploymentAssignmentOrganizationResolver,
  ) {}

  async findAll(actor: User, query: EmployeeListQueryDto = {}) {
    let rows = await this.access.listVisibleEmployees(actor);
    const orgByEmployee = await this.batchDisplayedOrgProjection(rows);

    const deptIds = unionIdLists(query.departmentId, query.departmentIds);
    if (deptIds.length) {
      rows = rows.filter(
        (e) => e.departmentId && deptIds.includes(e.departmentId),
      );
    }

    const positionIds = unionIdLists(query.positionId, query.positionIds);
    if (positionIds.length) {
      rows = rows.filter(
        (e) => e.positionId && positionIds.includes(e.positionId),
      );
    }

    const directionIds = [...new Set(query.directionIds ?? [])];
    if (directionIds.length) {
      rows = rows.filter((e) => {
        const dirId = orgByEmployee.get(e.id)?.displayedDirection.directionId;
        return Boolean(dirId && directionIds.includes(dirId));
      });
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

    const scoreById = await this.batchCompleteness(rows, orgByEmployee);

    if (query.maxCompleteness != null) {
      const max = query.maxCompleteness;
      rows = rows.filter((e) => (scoreById.get(e.id) ?? 0) <= max);
    }

    const dir: 1 | -1 = query.sortDir?.toLowerCase() === 'desc' ? -1 : 1;
    const key = (query.sortBy ?? 'fullName').toLowerCase();
    if (key === 'completeness') {
      rows.sort((a, b) => {
        const scoreDiff =
          (scoreById.get(a.id) ?? 0) - (scoreById.get(b.id) ?? 0);
        if (scoreDiff !== 0) return scoreDiff * dir;
        return compareEmployeeDirectoryLabels(
          {
            primary: this.serializer.fullName(a),
            fullName: this.serializer.fullName(a),
            employeeNumber: a.employeeNumber,
          },
          {
            primary: this.serializer.fullName(b),
            fullName: this.serializer.fullName(b),
            employeeNumber: b.employeeNumber,
          },
          1,
        );
      });
    } else {
      rows.sort((a, b) =>
        compareEmployeeDirectoryLabels(
          {
            primary: this.sortLabel(a, key, orgByEmployee),
            fullName: this.serializer.fullName(a),
            employeeNumber: a.employeeNumber,
          },
          {
            primary: this.sortLabel(b, key, orgByEmployee),
            fullName: this.serializer.fullName(b),
            employeeNumber: b.employeeNumber,
          },
          dir,
        ),
      );
    }

    // After listVisibleEmployees, every row is in-scope → work contacts OK without per-row DB.
    return Promise.all(
      rows.map((e) =>
        this.serializer.toListDto(e, actor, {
          canViewWorkContacts: true,
          completenessPercent: scoreById.get(e.id) ?? 0,
          displayedDirection:
            orgByEmployee.get(e.id)?.displayedDirection ?? {
              directionId: null,
              directionName: null,
            },
        }),
      ),
    );
  }

  /**
   * Canonical current EA + displayedDirection (EA → position.direction → department.direction).
   * Same map drives directionIds filter, sortBy=direction, and list DTO.
   */
  private async batchDisplayedOrgProjection(
    rows: Employee[],
  ): Promise<Map<string, DisplayedOrgProjection>> {
    const out = new Map<string, DisplayedOrgProjection>();
    if (rows.length === 0) return out;

    const employeeIds = rows.map((e) => e.id);
    const currentIds = rows
      .map((e) => e.currentAssignmentId)
      .filter((id): id is string => Boolean(id));

    const [pointedAssignments, activeAssignments] = await Promise.all([
      currentIds.length
        ? this.assignments.find({
            where: { id: In(currentIds) },
            relations: ['direction'],
          })
        : Promise.resolve([] as EmploymentAssignment[]),
      this.assignments.find({
        where: {
          employeeId: In(employeeIds),
          status: 'active',
        },
        relations: ['direction'],
      }),
    ]);

    const byEmployee = new Map<string, EmploymentAssignment[]>();
    for (const a of [...pointedAssignments, ...activeAssignments]) {
      const list = byEmployee.get(a.employeeId) ?? [];
      if (!list.some((x) => x.id === a.id)) list.push(a);
      byEmployee.set(a.employeeId, list);
    }
    // Stale pointer may reference another employee's row — keep it in candidate pool
    // keyed under that foreign employeeId; selection for this employee still ignores it.
    for (const a of pointedAssignments) {
      const list = byEmployee.get(a.employeeId) ?? [];
      if (!list.some((x) => x.id === a.id)) {
        list.push(a);
        byEmployee.set(a.employeeId, list);
      }
    }

    for (const e of rows) {
      const candidates = [
        ...(byEmployee.get(e.id) ?? []),
        // Include pointed row even if it belongs to another employee (selection rejects it).
        ...(e.currentAssignmentId
          ? pointedAssignments.filter((a) => a.id === e.currentAssignmentId)
          : []),
      ];
      const unique = new Map(candidates.map((c) => [c.id, c]));
      const selectedMeta = selectCurrentEmploymentAssignment(
        [...unique.values()].map((c) => ({
          id: c.id,
          employeeId: c.employeeId,
          status: c.status,
          startDate: c.startDate,
        })),
        e.id,
        e.currentAssignmentId,
      );
      const selectedAssignment = selectedMeta
        ? (unique.get(selectedMeta.id) ?? null)
        : null;

      const displayedDirection = resolveEmployeeDisplayedDirection({
        assignmentDirection: selectedAssignment?.directionId
          ? {
              id: selectedAssignment.directionId,
              name: selectedAssignment.direction?.name ?? null,
            }
          : null,
        positionDirection: e.position?.directionId
          ? {
              id: e.position.directionId,
              name: e.position.direction?.name ?? null,
            }
          : null,
        departmentDirection: e.department?.directionId
          ? {
              id: e.department.directionId,
              name: e.department.direction?.name ?? null,
            }
          : null,
      });

      out.set(e.id, { displayedDirection, selectedAssignment });
    }

    return out;
  }

  /**
   * Core completeness for surviving rows only (contacts + canonical selected EA).
   */
  private async batchCompleteness(
    rows: Employee[],
    orgByEmployee: Map<string, DisplayedOrgProjection>,
  ): Promise<Map<string, number>> {
    const scoreById = new Map<string, number>();
    if (rows.length === 0) return scoreById;

    const employeeIds = rows.map((e) => e.id);
    const workContacts = await this.contacts.find({
      where: {
        employeeId: In(employeeIds),
        type: In(['work_phone', 'work_email']),
      },
    });

    const contactsByEmployee = new Map<string, EmployeeContact[]>();
    for (const c of workContacts) {
      const list = contactsByEmployee.get(c.employeeId) ?? [];
      list.push(c);
      contactsByEmployee.set(c.employeeId, list);
    }

    for (const e of rows) {
      const assignment = orgByEmployee.get(e.id)?.selectedAssignment ?? null;
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

    return scoreById;
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
      accountRoleId: null as string | null,
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
    dto: CreateEmployeeDto,
  ): Promise<CreateEmployeeResponse> {
    const authz = await this.authorization.resolve(actor.id);
    if (!hasPermission(authz, Permission.EmployeesCreate)) {
      throw new ForbiddenException();
    }

    this.assertCreateFieldPolicy(authz, dto);

    const actorAccess = await this.access.resolveActorContext(actor);
    const requestedDirectionId = this.optionalUuid(dto.directionId);
    const requestedDepartmentId = this.optionalUuid(dto.departmentId);
    const requestedPositionId = this.optionalUuid(dto.positionId);

    let createdId: string;
    let openDetail: boolean;
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const resolved = await this.assignmentOrg.resolve(manager, {
          mode: 'create',
          effective: {
            positionId: requestedPositionId,
            departmentId: requestedDepartmentId,
            directionId: requestedDirectionId,
          },
          existing: null,
        });

        const { position, managedDepartmentIds: templateDepts } =
          await loadPositionManagerTemplate(manager, resolved.positionId);
        const membership = resolveManagerMembershipForCreate({
          position,
          positionManagedDepartmentIds: templateDepts,
          assignmentDepartmentId: resolved.departmentId,
        });

        const employeeRepo = manager.getRepository(Employee);
        const assignmentRepo = manager.getRepository(EmploymentAssignment);
        const roleRepo = manager.getRepository(AccountRole);

        let numberingRole: AccountRole | null = null;
        let accountRoleSource: 'explicit' | 'leadership_seed' | null = null;
        const requestedAccountRoleIdRaw = dto.accountRoleId?.trim() || null;
        if (requestedAccountRoleIdRaw) {
          numberingRole = await roleRepo.findOne({
            where: { id: requestedAccountRoleIdRaw },
            lock: { mode: 'pessimistic_read' },
          });
          if (!numberingRole) {
            throw new BadRequestException('Account role not found');
          }
          if (
            !canAssignAccountRole({
              actorAuthz: authz,
              actorUserId: actor.id,
              targetUserId: null,
              currentTargetRole: null,
              nextRole: numberingRole,
            })
          ) {
            throw new ForbiddenException();
          }
          accountRoleSource = 'explicit';
        }

        const requestedNumber = dto.employeeNumber?.trim();
        let employeeNumber: string;
        if (requestedNumber) {
          employeeNumber = requestedNumber;
        } else {
          const prefix = employeeNumberPrefixForCreate({
            accountRole: numberingRole,
            membership,
          });
          employeeNumber = await this.numberAllocator.allocate(manager, prefix);
        }

        const emp = await employeeRepo.save(
          employeeRepo.create({
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            middleName: dto.middleName?.trim() || null,
            departmentId: resolved.departmentId,
            positionId: resolved.positionId,
            employeeNumber,
            role: UserRole.Employee,
            userId: null,
            calendarColor: dto.calendarColor ?? null,
            phoneNumber: null,
            telegram: null,
            workEmail: null,
            personalPhoneNumber: null,
            personalTelegram: null,
            personalEmail: null,
            isDepartmentManager: false,
            profileVisibilityOverride: null,
            absenceVisibilityOverride: null,
            showAbsenceTypeToPeersOverride: null,
            isActive: true,
          }),
        );

        const today = this.businessDateClock.today();
        const assignment = await assignmentRepo.save(
          assignmentRepo.create({
            employeeId: emp.id,
            companyId: resolved.companyId,
            directionId: resolved.directionId,
            departmentId: resolved.departmentId,
            positionId: resolved.positionId,
            status: 'active',
            startDate: today,
            managementKind: membership.managementKind,
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

        await this.contactsFacade.initializeForCreate(
          manager,
          { id: actor.id },
          emp.id,
          {
            work: {
              email: dto.workEmail ?? null,
              phone: dto.phoneNumber ?? null,
              telegram: dto.telegram ?? null,
            },
            personal: this.personalContactsFromCreateDto(dto),
          },
        );

        let requestedAccountRoleId: string | null = null;
        let effectiveAccountRoleId: string | null = null;
        let bridgeApplied = false;
        const createAccount = dto.createAccount === true;

        if (numberingRole) {
          requestedAccountRoleId = numberingRole.id;
        }

        if (createAccount) {
          if (!dto.email || !dto.temporaryPassword) {
            throw new BadRequestException(
              'email and temporaryPassword are required when createAccount=true',
            );
          }
          const txAuthz = await this.authorization.resolve(actor.id, manager);
          if (!canCreateAccountAtEmployeeCreate(txAuthz)) {
            throw new ForbiddenException();
          }
          const email = dto.email.toLowerCase().trim();
          const existing = await manager.getRepository(User).findOne({
            where: { email },
          });
          if (existing) {
            throw new ConflictException('Email already in use');
          }

          let requestedRole: AccountRole | null = numberingRole;
          if (!requestedRole) {
            const systemCode =
              defaultSystemAccountRoleCodeFromLeadership(
                membership.managementKind as EmploymentManagementKind,
              ) === 'department_manager'
                ? SystemAccountRoleCode.DepartmentManager
                : SystemAccountRoleCode.Employee;
            const systemRoleId = await resolveSystemAccountRoleId(
              manager,
              systemCode,
            );
            requestedRole = await roleRepo.findOne({
              where: { id: systemRoleId },
              lock: { mode: 'pessimistic_read' },
            });
            if (!requestedRole) {
              throw new BadRequestException('System account role not found');
            }
            accountRoleSource = 'leadership_seed';
          }

          requestedAccountRoleId = requestedRole.id;
          const mirrorRole = userRoleMirrorFor(requestedRole);
          const userRepo = manager.getRepository(User);
          const user = await userRepo.save(
            userRepo.create({
              email,
              passwordHash: await bcrypt.hash(dto.temporaryPassword, 12),
              role: mirrorRole,
              accountRoleId: requestedRole.id,
              isDepartmentManager: false,
              status: UserStatus.Active,
              mustChangePassword: true,
              tokenVersion: 0,
              passwordChangedAt: null,
              lastLoginAt: null,
            }),
          );

          const fresh = await employeeRepo.findOneOrFail({
            where: { id: emp.id },
          });
          fresh.userId = user.id;
          fresh.role = mirrorRole;
          await employeeRepo.save(fresh);

          const projection = await this.identityRoleProjection.apply(
            manager,
            fresh,
            { bumpTokenVersion: false },
          );
          effectiveAccountRoleId = projection.newAccountRoleId;
          bridgeApplied = false;
        } else {
          await this.identityRoleProjection.apply(manager, emp, {
            bumpTokenVersion: false,
          });
        }

        const scheduleDays =
          dto.schedule?.length === 7 ? dto.schedule : this.defaultSchedule();
        await this.replaceScheduleInternal(emp.id, scheduleDays, manager);

        await this.audit.record(
          {
            actorId: actor.id,
            action: 'employee.created',
            entityType: 'Employee',
            entityId: emp.id,
            metadata: {
              employeeNumber: emp.employeeNumber,
              createAccount,
              accountCreationAuthorization: createAccount
                ? authz.isAdminEquivalent
                  ? 'admin_equivalent'
                  : 'employees.create_account_at_create'
                : null,
              requestedAccountRoleId,
              effectiveAccountRoleId,
              bridgeApplied,
              accountRoleSource,
              canAssignAccountRole: hasPermission(
                authz,
                Permission.EmployeesAssignAccountRole,
              ),
            },
          },
          manager,
        );

        return {
          id: emp.id,
          openDetail: this.resolveOpenDetailAfterCreate(
            authz,
            actorAccess,
            resolved.departmentId,
          ),
        };
      });
      createdId = result.id;
      openDetail = result.openDetail;
    } catch (error) {
      rethrowAssignmentWriteError(error);
    }

    return { id: createdId, openDetail };
  }

  private assertCreateFieldPolicy(
    authz: AuthorizationContext,
    dto: CreateEmployeeDto,
  ): void {
    const createAccount = dto.createAccount === true;
    const credentialPresent = Boolean(
      dto.email?.trim() || dto.temporaryPassword,
    );
    if (!createAccount && credentialPresent) {
      throw new BadRequestException(
        'email and temporaryPassword require createAccount=true',
      );
    }

    const personalProvided = Boolean(
      dto.personalEmail?.trim() ||
        dto.personalPhoneNumber?.trim() ||
        dto.personalTelegram?.trim(),
    );
    if (
      personalProvided &&
      !authz.isAdminEquivalent &&
      !hasPermission(authz, Permission.EmployeesWritePersonal)
    ) {
      throw new ForbiddenException();
    }

    // createAccount requires EmployeesCreateAccountAtCreate (or adminEq).
    // Explicit accountRoleId requires Assign + admin-equivalent ceiling.
    if (createAccount && !canCreateAccountAtEmployeeCreate(authz)) {
      throw new ForbiddenException();
    }

    if (dto.accountRoleId?.trim()) {
      // Ceiling checked after role load in create TX; here fail-closed without Assign.
      if (
        !authz.isAdminEquivalent &&
        !hasPermission(authz, Permission.EmployeesAssignAccountRole)
      ) {
        throw new ForbiddenException();
      }
    }

    if (dto.employeeNumber?.trim() && !authz.isAdminEquivalent) {
      throw new ForbiddenException();
    }
  }

  private personalContactsFromCreateDto(
    dto: CreateEmployeeDto,
  ): PersonalContactWriteInput[] {
    const contacts: PersonalContactWriteInput[] = [];
    if (dto.personalPhoneNumber?.trim()) {
      contacts.push({
        type: 'personal_phone',
        value: dto.personalPhoneNumber.trim(),
        isPrimary: true,
      });
    }
    if (dto.personalEmail?.trim()) {
      contacts.push({
        type: 'personal_email',
        value: dto.personalEmail.trim(),
        isPrimary: true,
      });
    }
    if (dto.personalTelegram?.trim()) {
      contacts.push({
        type: 'personal_telegram',
        value: dto.personalTelegram.trim(),
        isPrimary: true,
      });
    }
    return contacts;
  }

  private resolveOpenDetailAfterCreate(
    authz: AuthorizationContext,
    actorAccess: ActorAccessContext,
    targetDepartmentId: string | null,
  ): boolean {
    if (!hasPermission(authz, Permission.EmployeesView)) {
      return false;
    }
    if (actorAccess.scope === 'all') {
      return true;
    }
    if (actorAccess.scope === 'managed_departments') {
      return Boolean(
        targetDepartmentId &&
          actorAccess.managedDepartmentIds.includes(targetDepartmentId),
      );
    }
    return false;
  }

  async update(actor: User, id: string, dto: UpdateEmployeeInput) {
    const authz = await this.authorization.resolve(actor.id);
    // Legacy mixed PATCH — adminEquivalent-only compatibility (canonical writers elsewhere).
    if (!authz.isAdminEquivalent) {
      throw new ForbiddenException();
    }
    const employee = await this.access.getEmployeeOrFail(id);

    if (dto.firstName !== undefined) employee.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) employee.lastName = dto.lastName.trim();
    if (dto.middleName !== undefined)
      employee.middleName = dto.middleName?.trim() || null;
    if (dto.employeeNumber !== undefined) {
      employee.employeeNumber = dto.employeeNumber.trim();
    }
    // Legacy org patch: display mirror only — Access SoT is active EA.
    // Prefer EA writer; Absences should be read-only for dept/position.
    const orgPatch = pickLegacyOrgAssignmentPatch(authz, dto);
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
    if (dto.personalPhoneNumber !== undefined) {
      employee.personalPhoneNumber = dto.personalPhoneNumber;
    }
    if (dto.personalTelegram !== undefined) {
      employee.personalTelegram = dto.personalTelegram;
    }
    if (dto.personalEmail !== undefined) {
      employee.personalEmail = dto.personalEmail;
    }
    if (dto.comment !== undefined) {
      employee.comment = dto.comment;
    }
    if (dto.adminComment !== undefined) {
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
      metadata: { fields: Object.keys(dto), legacyPatch: true },
    });

    return this.findOne(actor, id);
  }

  async updateAccessSettings(
    actor: User,
    id: string,
    dto: UpdateAccessSettingsInput,
  ) {
    const actorCtx = await this.authorization.resolve(actor.id);
    const mayAssign =
      actorCtx.isAdminEquivalent ||
      hasPermission(actorCtx, Permission.EmployeesAssignAccountRole);
    if (!mayAssign) {
      throw new ForbiddenException();
    }

    const visibilityRequested =
      dto.profileVisibilityOverride !== undefined ||
      dto.absenceVisibilityOverride !== undefined ||
      dto.showAbsenceTypeToPeersOverride !== undefined;
    if (visibilityRequested && !actorCtx.isAdminEquivalent) {
      throw new ForbiddenException();
    }

    const targetEmployee = await this.access.getEmployeeOrFail(id);
    if (
      !actorCtx.isAdminEquivalent &&
      !(await this.access.isTargetInManagedDepartments(actor, targetEmployee))
    ) {
      throw new ForbiddenException();
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const employeeRepo = manager.getRepository(Employee);
      const userRepo = manager.getRepository(User);
      const roleRepo = manager.getRepository(AccountRole);

      const emp = await employeeRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!emp) throw new NotFoundException('Employee not found');

      let user: User | null = null;
      if (emp.userId) {
        user = await userRepo.findOne({
          where: { id: emp.userId },
          lock: { mode: 'pessimistic_write' },
        });
      }

      const before = {
        role: emp.role,
        accountRoleId: user?.accountRoleId ?? null,
        profileVisibilityOverride: emp.profileVisibilityOverride,
        absenceVisibilityOverride: emp.absenceVisibilityOverride,
        showAbsenceTypeToPeersOverride: emp.showAbsenceTypeToPeersOverride,
      };

      if (dto.profileVisibilityOverride !== undefined) {
        emp.profileVisibilityOverride = dto.profileVisibilityOverride;
      }
      if (dto.absenceVisibilityOverride !== undefined) {
        emp.absenceVisibilityOverride = dto.absenceVisibilityOverride;
      }
      if (dto.showAbsenceTypeToPeersOverride !== undefined) {
        emp.showAbsenceTypeToPeersOverride = this.peerTypeOverrideToColumn(
          dto.showAbsenceTypeToPeersOverride,
        );
      }
      await employeeRepo.save(emp);

      let requestedAccountRole: AccountRole | null = null;
      let effectiveAccountRole: AccountRole | null = null;

      if (dto.accountRoleId !== undefined) {
        if (!user) {
          throw new BadRequestException('Employee has no account');
        }
        requestedAccountRole = await roleRepo.findOne({
          where: { id: dto.accountRoleId },
        });
        if (!requestedAccountRole) {
          throw new BadRequestException('Account role not found');
        }

        const currentTargetRole = user.accountRoleId
          ? await roleRepo.findOne({ where: { id: user.accountRoleId } })
          : null;

        if (
          !canAssignAccountRole({
            actorAuthz: actorCtx,
            actorUserId: actor.id,
            targetUserId: user.id,
            currentTargetRole,
            nextRole: requestedAccountRole,
          })
        ) {
          throw new ForbiddenException();
        }

        await this.lastAdmin.assertUserDemotionAllowed(
          manager,
          user.id,
          requestedAccountRole.isAdminEquivalent,
        );

        user.accountRoleId = requestedAccountRole.id;
        user.role = compatibilityUserRoleFromAccountRole(requestedAccountRole);
        emp.role = user.role;
        await userRepo.save(user);
        await employeeRepo.save(emp);

        // Mirror sync only — AccountRole is not rewritten from EA leadership.
        await this.identityRoleProjection.apply(manager, emp, {
          bumpTokenVersion: false,
        });

        const freshUser = await userRepo.findOneOrFail({
          where: { id: user.id },
        });
        effectiveAccountRole = await roleRepo.findOneOrFail({
          where: { id: freshUser.accountRoleId },
        });

        const mirror = compatibilityUserRoleFromAccountRole(
          effectiveAccountRole,
        );
        const roleChanged =
          before.accountRoleId !== freshUser.accountRoleId ||
          before.role !== mirror;
        freshUser.role = mirror;
        emp.role = mirror;
        if (roleChanged) {
          freshUser.tokenVersion = (freshUser.tokenVersion ?? 0) + 1;
        }
        await userRepo.save(freshUser);
        await employeeRepo.save(emp);
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
              accountRoleId: (await userRepo.findOne({
                where: { id: emp.userId ?? undefined },
              }))?.accountRoleId,
              requestedAccountRoleId: requestedAccountRole?.id ?? null,
              effectiveAccountRoleId: effectiveAccountRole?.id ?? null,
              profileVisibilityOverride: after.profileVisibilityOverride,
              absenceVisibilityOverride: after.absenceVisibilityOverride,
              showAbsenceTypeToPeersOverride:
                after.showAbsenceTypeToPeersOverride,
            },
          },
        },
        manager,
      );

      return {
        requestedAccountRole,
        effectiveAccountRole,
      };
    });

    const employee = await this.findOne(actor, id);
    return {
      ...employee,
      requestedAccountRole: result.requestedAccountRole
        ? {
            id: result.requestedAccountRole.id,
            code: result.requestedAccountRole.code,
            name: result.requestedAccountRole.name,
          }
        : undefined,
      effectiveAccountRole: result.effectiveAccountRole
        ? {
            id: result.effectiveAccountRole.id,
            code: result.effectiveAccountRole.code,
            name: result.effectiveAccountRole.name,
          }
        : undefined,
    };
  }

  async updateAccountEmail(actor: User, id: string, email: string) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!(await this.access.canEditAccountEmail(actor, employee))) {
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

  async previewNextEmployeeNumber(
    actor: User,
    role?: UserRole,
  ): Promise<{ employeeNumber: string }> {
    const authz = await this.authorization.resolve(actor.id);
    if (!hasPermission(authz, Permission.EmployeesCreate)) {
      throw new ForbiddenException();
    }
    const effective = role ?? UserRole.Employee;
    const prefix =
      effective === UserRole.Admin
        ? 'A'
        : effective === UserRole.DepartmentManager
          ? 'M'
          : 'E';
    const employeeNumber = await this.dataSource.transaction(async (manager) =>
      this.numberAllocator.peekNext(manager, prefix),
    );
    return { employeeNumber };
  }

  async previewNextEmployeeNumberFromPosition(
    actor: User,
    positionId?: string | null,
  ) {
    const authz = await this.authorization.resolve(actor.id);
    if (!hasPermission(authz, Permission.EmployeesCreate)) {
      throw new ForbiddenException();
    }
    return this.dataSource.transaction(async (manager) => {
      const { position, managedDepartmentIds } =
        await loadPositionManagerTemplate(
          manager,
          positionId ? this.optionalUuid(positionId) : null,
        );
      const membership = resolveManagerMembershipForCreate({
        position,
        positionManagedDepartmentIds: managedDepartmentIds,
        assignmentDepartmentId: position?.departmentId ?? null,
      });
      const prefix = employeeNumberPrefixFromMembership(membership);
      const employeeNumber = await this.numberAllocator.peekNext(
        manager,
        prefix,
      );
      return { employeeNumber };
    });
  }

  async attachAccount(
    actor: User,
    id: string,
    dto: {
      email: string;
      temporaryPassword: string;
      accountRoleId?: string;
    },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!(await this.access.canCreateEmployeeAccount(actor, employee))) {
      throw new ForbiddenException();
    }
    const authz = await this.authorization.resolve(actor.id);
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('Email already in use');
    }

    const requestedRoleId = dto.accountRoleId?.trim() || null;
    if (
      requestedRoleId &&
      !authz.isAdminEquivalent &&
      !hasPermission(authz, Permission.EmployeesAssignAccountRole)
    ) {
      throw new ForbiddenException();
    }

    await this.dataSource.transaction(async (manager) => {
      const employeeRepo = manager.getRepository(Employee);
      const emp = await employeeRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!emp) throw new NotFoundException('Employee not found');

      const roleRepo = manager.getRepository(AccountRole);
      let accountRole: AccountRole;
      if (requestedRoleId) {
        const nextRole = await roleRepo.findOne({
          where: { id: requestedRoleId },
        });
        if (!nextRole) {
          throw new BadRequestException('Account role not found');
        }
        if (
          !canAssignAccountRole({
            actorAuthz: authz,
            actorUserId: actor.id,
            targetUserId: null,
            currentTargetRole: null,
            nextRole,
          })
        ) {
          throw new ForbiddenException();
        }
        accountRole = nextRole;
      } else {
        const activeEa = emp.currentAssignmentId
          ? await manager.getRepository(EmploymentAssignment).findOne({
              where: { id: emp.currentAssignmentId },
            })
          : null;
        const leadershipKind = (
          isManagementKind(activeEa?.managementKind)
            ? activeEa!.managementKind
            : ManagementKind.None
        ) as EmploymentManagementKind;
        const desiredCode =
          defaultSystemAccountRoleCodeFromLeadership(leadershipKind) ===
          'department_manager'
            ? SystemAccountRoleCode.DepartmentManager
            : SystemAccountRoleCode.Employee;
        const accountRoleId = await resolveSystemAccountRoleId(
          manager,
          desiredCode,
        );
        accountRole = await roleRepo.findOneOrFail({
          where: { id: accountRoleId },
        });
      }

      const mirror = compatibilityUserRoleFromAccountRole(accountRole);

      const userRepo = manager.getRepository(User);
      const user = await userRepo.save(
        userRepo.create({
          email,
          passwordHash: await bcrypt.hash(dto.temporaryPassword, 12),
          role: mirror,
          accountRoleId: accountRole.id,
          isDepartmentManager: false,
          status: UserStatus.Active,
          mustChangePassword: true,
          tokenVersion: 0,
          passwordChangedAt: null,
          lastLoginAt: null,
        }),
      );
      emp.userId = user.id;
      emp.role = mirror;
      await employeeRepo.save(emp);
      await this.identityRoleProjection.apply(manager, emp, {
        bumpTokenVersion: false,
      });
    });

    return this.findOne(actor, id);
  }

  async updateAccountStatus(
    actor: User,
    id: string,
    status: 'active' | 'deactivated',
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!(await this.access.canDestructivelyManageAccount(actor, employee))) {
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
    if (!(await this.access.canDestructivelyManageAccount(actor, employee))) {
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
    manager?: EntityManager,
  ) {
    const schedules = manager
      ? manager.getRepository(WorkScheduleDay)
      : this.schedules;
    await schedules.delete({ employeeId });
    const rows = days.map((d) => {
      const isWorkingDay =
        d.isWorkingDay !== undefined
          ? Boolean(d.isWorkingDay)
          : d.isDayOff !== undefined
            ? !d.isDayOff
            : true;
      return schedules.create({
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
    await schedules.save(rows);
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

  private sortLabel(
    e: Employee,
    key: string,
    orgByEmployee: Map<string, DisplayedOrgProjection>,
  ): string {
    switch (key) {
      case 'employeenumber':
      case 'number':
        return e.employeeNumber;
      case 'department':
      case 'departmentname':
        return e.department?.name ?? '';
      case 'position':
      case 'positionname':
        return e.position?.name ?? '';
      case 'direction':
      case 'directionname':
        return orgByEmployee.get(e.id)?.displayedDirection.directionName ?? '';
      case 'role': {
        const hasAccount = e.userId != null;
        const accountRole = e.user?.accountRole
          ? {
              id: e.user.accountRole.id,
              code: e.user.accountRole.code,
              name: e.user.accountRole.name,
              isAdminEquivalent: Boolean(e.user.accountRole.isAdminEquivalent),
            }
          : null;
        if (hasAccount && !accountRole) {
          // Serializer will fail closed; keep sort deterministic.
          return '';
        }
        return resolveEmployeeListRoleLabel({
          hasAccount,
          legacyRole: e.role,
          isDepartmentManager: e.role === 'department_manager',
          accountRole,
        });
      }
      case 'status':
        return resolveEmployeeListStatusLabel({
          hasAccount: e.userId != null,
          accountStatus:
            e.user?.status === UserStatus.Deactivated
              ? 'deactivated'
              : e.userId
                ? 'active'
                : null,
        });
      default:
        return this.serializer.fullName(e);
    }
  }

  /** Empty / whitespace optional UUID fields → null (department & position are optional). */
  private optionalUuid(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
