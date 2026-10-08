import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UsersService } from '../../platform/identity/users.service';
import { UserRole, UserStatus } from '../../platform/identity/user.enums';
import { AuditService } from '../../platform/audit/audit.service';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import {
  hasPermission,
} from '../../platform/access-control/authorization-context';
import { Permission } from '../../platform/permissions/permission.names';
import {
  canChangeAssignmentOnTarget,
  canChangeStatusOnTarget,
  canDeleteEmployee,
  canDestructivelyManageAccount,
  canEditAccountEmail,
  canEditEmergencyOnTarget,
  canExportProfile,
  canManageProfilesOnTarget,
  canResetPassword,
  canViewAccountDetails,
  canViewEmergencyContact,
  canViewHistory,
  canViewPersonalContacts,
  canWritePersonalOnTarget,
} from './employee-profile-authz';
import { EmployeeAccessService } from '../access/employee-access.service';
import { Employee } from './employee.entity';
import { EmployeeContact } from './employee-contact.entity';
import { EmployeeEmergencyContact } from './employee-emergency-contact.entity';
import { EmployeeImportantDate } from './employee-important-date.entity';
import { EmploymentAssignment } from './employment-assignment.entity';
import { Company } from '../companies/company.entity';
import { Direction } from '../companies/direction.entity';
import { EmployeeSerializer } from './employee.serializer';
import { AuditLog } from '../../platform/audit/audit-log.entity';
import {
  buildProfileCompletenessFacts,
  computeProfileCompleteness,
  projectProfileCompleteness,
} from './employee-profile-completeness';
import {
  projectEmployeeHistoryItem,
  resolveHistoryActorLabel,
} from './employee-history.projector';
import {
  isPersonalContactType,
  resolvePrimaryPersonalValue,
  type PersonalContactWriteInput,
} from './employee-personal-contacts';
import { EmployeeContactsFacade } from './employee-contacts.facade';
import { PositionsService } from '../positions/positions.service';
import { Position } from '../positions/position.entity';
import { Department } from '../departments/department.entity';
import { DepartmentsService } from '../departments/departments.service';
import { EmploymentCatalogService } from '../employment-catalog/employment-catalog.service';
import { CurrentEmploymentAssignmentResolver } from '../employment-catalog/current-employment-assignment.resolver';
import { BusinessDateClock } from './business-date-clock';
import {
  getPositionBlockedReason,
  isDepartmentSelectable,
  isDirectionSelectable,
  isPositionSelectable,
} from './organization-selectability.policy';
import {
  loadPositionManagerTemplate,
  replaceAssignmentManagedDepartments,
  resolveManagerMembershipForCreate,
} from './managed-department-writes';
import { IdentityRoleProjection } from './identity-role-projection';
import {
  AssignmentHierarchyChangedDuringResolutionError,
  EmploymentAssignmentOrganizationResolver,
  rethrowAssignmentWriteError,
  shouldRetryHierarchyDrift,
} from './employment-assignment-organization.resolver';

type AssignmentWriteDto = {
  directionId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  functionalRole?: string | null;
  managerEmployeeId?: string | null;
  mentorEmployeeId?: string | null;
  hrResponsibleEmployeeId?: string | null;
  workLocation?: string | null;
  workFormat?: string | null;
  employmentType?: string | null;
  contractType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  probationStartDate?: string | null;
  probationEndDate?: string | null;
  comment?: string | null;
  /** Org leadership write (ADR 0011) — wire SoT EmploymentManagementKind. */
  managementKind?: 'none' | 'departments' | 'direction';
  /** @deprecated use managementKind. */
  isDepartmentManager?: boolean;
  managedDepartmentIds?: string[];
};

export type ProfileCapabilities = {
  canEditBasic: boolean;
  canEditEmployment: boolean;
  canViewPersonal: boolean;
  canEditPersonal: boolean;
  canViewEmergencyContact: boolean;
  canEditEmergencyContact: boolean;
  canChangeStatus: boolean;
  canExport: boolean;
  canViewHistory: boolean;
  canStartOnboarding: boolean;
  canAssignQuestionnaire: boolean;
  canCreateAccount: boolean;
  canResetPassword: boolean;
  canManageAccount: boolean;
  canDeleteEmployee: boolean;
  canEditAdminAccess: boolean;
  canEditVisibilityOverrides: boolean;
  canViewAccountDetails: boolean;
  canEditAccountEmail: boolean;
};

@Injectable()
export class EmployeeProfileService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(EmployeeContact)
    private readonly contacts: Repository<EmployeeContact>,
    @InjectRepository(EmployeeEmergencyContact)
    private readonly emergencies: Repository<EmployeeEmergencyContact>,
    @InjectRepository(EmployeeImportantDate)
    private readonly importantDates: Repository<EmployeeImportantDate>,
    @InjectRepository(EmploymentAssignment)
    private readonly assignments: Repository<EmploymentAssignment>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Direction)
    private readonly directions: Repository<Direction>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
    private readonly access: EmployeeAccessService,
    private readonly serializer: EmployeeSerializer,
    private readonly audit: AuditService,
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
    private readonly contactsFacade: EmployeeContactsFacade,
    private readonly departmentsService: DepartmentsService,
    private readonly positions: PositionsService,
    private readonly employmentCatalogs: EmploymentCatalogService,
    private readonly currentEmployment: CurrentEmploymentAssignmentResolver,
    private readonly businessDateClock: BusinessDateClock,
    private readonly identityRoleProjection: IdentityRoleProjection,
    private readonly assignmentOrg: EmploymentAssignmentOrganizationResolver,
    private readonly authorization: AuthorizationContextService,
  ) {}

  private parseOptionalDateOnly(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new BadRequestException('Date must be YYYY-MM-DD');
    }
    const probe = new Date(`${trimmed}T12:00:00Z`);
    if (
      Number.isNaN(probe.getTime()) ||
      probe.toISOString().slice(0, 10) !== trimmed
    ) {
      throw new BadRequestException(`Invalid date: ${trimmed}`);
    }
    return trimmed;
  }

  private normalizeOptionalText(
    value: string | null | undefined,
    maxLength: number,
    field: string,
  ): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.length > maxLength) {
      throw new BadRequestException(
        `${field} must be at most ${maxLength} characters`,
      );
    }
    return trimmed;
  }

  async capabilities(actor: User, target: Employee): Promise<ProfileCapabilities> {
    const authz = await this.authorization.resolve(actor.id);
    const [canView, inManagedDept] = await Promise.all([
      this.access.canViewEmployeeProfile(actor, target),
      this.access.isTargetInManagedDepartments(actor, target, authz),
    ]);
    const owner = this.access.isOwner(actor, target);
    const canEditBasic = canManageProfilesOnTarget(authz, inManagedDept);
    const hasAccount = target.userId != null;
    const isSelf = target.userId === actor.id;

    return {
      canEditBasic,
      canEditEmployment: canChangeAssignmentOnTarget(authz, inManagedDept),
      canViewPersonal: canViewPersonalContacts(authz, owner),
      canEditPersonal: canWritePersonalOnTarget(authz, inManagedDept),
      canViewEmergencyContact: canViewEmergencyContact(authz, owner),
      canEditEmergencyContact: canEditEmergencyOnTarget(
        authz,
        inManagedDept,
        owner,
      ),
      canChangeStatus: canChangeStatusOnTarget(authz, inManagedDept),
      canExport: canExportProfile(authz, canView),
      canViewHistory: canViewHistory(authz, canView),
      canStartOnboarding: false,
      canAssignQuestionnaire:
        hasPermission(authz, Permission.QuestionnairesAssign) && canView,
      canCreateAccount: await this.access.canCreateEmployeeAccount(
        actor,
        target,
        authz,
      ),
      canResetPassword: canResetPassword(authz, hasAccount),
      canManageAccount: canDestructivelyManageAccount(
        authz,
        hasAccount,
        isSelf,
      ),
      canDeleteEmployee: canDeleteEmployee(authz, isSelf),
      canEditAdminAccess: await this.access.canEditAdminAccess(actor, authz),
      canEditVisibilityOverrides: await this.access.canEditVisibilityOverrides(
        actor,
        target.role,
        authz,
      ),
      canViewAccountDetails: canViewAccountDetails(authz, owner),
      canEditAccountEmail: canEditAccountEmail(authz, {
        hasOtherUser: hasAccount,
        isSelf,
      }),
    };
  }

  /** Owner + Admin may see extended completeness; managers on others get null. */
  private async canViewExtendedCompleteness(
    actor: User,
    target: Employee,
  ): Promise<boolean> {
    if (this.access.isOwner(actor, target)) return true;
    const authz = await this.authorization.resolve(actor.id);
    return authz.isAdminEquivalent;
  }

  async getProfile(actor: User, id: string) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!(await this.access.canViewEmployeeProfile(actor, employee))) {
      throw new NotFoundException('Employee not found');
    }

    const caps = await this.capabilities(actor, employee);

    // Completeness facts: always load full rows (role-independent score).
    const [contacts, emergencyAll, importantDatesAll, resolvedAssignment] =
      await Promise.all([
        this.contacts.find({
          where: { employeeId: id },
          order: { type: 'ASC' },
        }),
        this.emergencies.find({
          where: { employeeId: id, isActive: true },
          order: { priority: 'ASC' },
        }),
        this.importantDates.find({
          where: { employeeId: id, isActive: true },
          order: { priority: 'ASC' },
        }),
        this.currentEmployment.resolve(employee),
      ]);

    const assignment = resolvedAssignment
      ? await this.assignments.findOne({
          where: { id: resolvedAssignment.id },
          relations: [
            'department',
            'position',
            'company',
            'direction',
            'managedDepartments',
          ],
        })
      : null;

    const facts = buildProfileCompletenessFacts({
      employee,
      contacts,
      emergencyCount: emergencyAll.length,
      importantDatesCount: importantDatesAll.length,
      assignment: assignment
        ? {
            status: assignment.status,
            departmentId: assignment.departmentId,
            positionId: assignment.positionId,
            startDate: assignment.startDate,
          }
        : null,
    });
    const scored = computeProfileCompleteness(facts);
    const completeness = projectProfileCompleteness(
      scored,
      await this.canViewExtendedCompleteness(actor, employee),
    );

    // Permission-aware projection for response sections only.
    const emergency = caps.canViewEmergencyContact ? emergencyAll : [];
    const importantDates = caps.canViewPersonal ? importantDatesAll : [];

    const visibleContacts = contacts.filter((c) => {
      if (c.visibility === 'personal' || c.type.startsWith('personal_')) {
        return caps.canViewPersonal;
      }
      return true;
    });

    const manager = assignment?.managerEmployeeId
      ? await this.employees.findOne({
          where: { id: assignment.managerEmployeeId },
        })
      : null;

    return {
      header: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        displayName: this.serializer.fullName(employee),
        preferredName: employee.preferredName,
        photoUrl: employee.photoUrl,
        employmentStatus: employee.employmentStatus,
        department: employee.department
          ? { id: employee.department.id, name: employee.department.name }
          : assignment?.department
            ? {
                id: assignment.department.id,
                name: assignment.department.name,
              }
            : null,
        position: employee.position
          ? { id: employee.position.id, name: employee.position.name }
          : assignment?.position
            ? { id: assignment.position.id, name: assignment.position.name }
            : null,
        company: assignment?.company
          ? { id: assignment.company.id, name: assignment.company.name }
          : null,
        direction: assignment?.direction
          ? { id: assignment.direction.id, name: assignment.direction.name }
          : null,
        manager: manager
          ? {
              id: manager.id,
              displayName: this.serializer.fullName(manager),
            }
          : null,
        hiredAt: employee.hiredAt,
        userId: employee.userId ?? null,
        hasAccount: employee.userId != null,
        accountStatus: employee.user
          ? employee.user.status === UserStatus.Deactivated
            ? 'deactivated'
            : 'active'
          : null,
        accountCreatedAt: employee.user?.createdAt
          ? employee.user.createdAt.toISOString()
          : null,
        ...(caps.canViewAccountDetails
          ? { accountEmail: employee.user?.email ?? null }
          : {}),
        workEmail: employee.workEmail,
        workPhone: employee.phoneNumber,
        workTelegram: employee.telegram,
        completenessPercent: completeness.core.percent,
      },
      sections: {
        overview: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          preferredName: employee.preferredName,
          employmentStatus: employee.employmentStatus,
          workFormat: assignment?.workFormat ?? null,
          probationEndsAt: assignment?.probationEndDate ?? null,
        },
        employment: assignment
          ? {
              id: assignment.id,
              companyId: assignment.companyId,
              directionId: assignment.directionId,
              departmentId: assignment.departmentId,
              positionId: assignment.positionId,
              functionalRole: assignment.functionalRole,
              managerEmployeeId: assignment.managerEmployeeId,
              mentorEmployeeId: assignment.mentorEmployeeId,
              hrResponsibleEmployeeId: assignment.hrResponsibleEmployeeId,
              workLocation: assignment.workLocation,
              workFormat: assignment.workFormat,
              employmentType: assignment.employmentType,
              contractType: assignment.contractType,
              startDate: assignment.startDate,
              endDate: assignment.endDate,
              probationStartDate: assignment.probationStartDate,
              probationEndDate: assignment.probationEndDate,
              status: assignment.status,
              isDepartmentManager: Boolean(assignment.isDepartmentManager),
              managementKind: assignment.managementKind ?? (assignment.isDepartmentManager ? 'departments' : 'none'),
              managedDepartmentIds: (assignment.managedDepartments ?? []).map(
                (row) => row.departmentId,
              ),
              activationBlockedReason: assignment.activationBlockedReason,
              activationCheckedAt: assignment.activationCheckedAt
                ? assignment.activationCheckedAt.toISOString()
                : null,
              company: assignment.company
                ? { id: assignment.company.id, name: assignment.company.name }
                : null,
              direction: assignment.direction
                ? {
                    id: assignment.direction.id,
                    name: assignment.direction.name,
                  }
                : null,
              department: assignment.department
                ? {
                    id: assignment.department.id,
                    name: assignment.department.name,
                  }
                : null,
              position: assignment.position
                ? {
                    id: assignment.position.id,
                    name: assignment.position.name,
                  }
                : null,
            }
          : null,
        contacts: visibleContacts.map((c) => ({
          id: c.id,
          type: c.type,
          value: c.value,
          isPrimary: c.isPrimary,
          visibility: c.visibility,
        })),
        personal: caps.canViewPersonal
          ? (() => {
              const legacy = {
                personalPhoneNumber: employee.personalPhoneNumber,
                personalEmail: employee.personalEmail,
                personalTelegram: employee.personalTelegram,
              };
              const personalContacts = contacts.filter((c) =>
                isPersonalContactType(c.type),
              );
              return {
                birthDate: employee.birthDate,
                city: employee.city,
                preferredLanguage: employee.preferredLanguage,
                preferredName: employee.preferredName,
                personalPhone: resolvePrimaryPersonalValue(
                  personalContacts,
                  'personal_phone',
                  legacy,
                ),
                personalEmail: resolvePrimaryPersonalValue(
                  personalContacts,
                  'personal_email',
                  legacy,
                ),
                personalTelegram: resolvePrimaryPersonalValue(
                  personalContacts,
                  'personal_telegram',
                  legacy,
                ),
              };
            })()
          : null,
        emergencyContact: caps.canViewEmergencyContact
          ? emergency.map((e) => ({
              id: e.id,
              fullName: e.fullName,
              relationship: e.relationship,
              primaryPhone: e.primaryPhone,
              secondaryPhone: e.secondaryPhone,
              priority: e.priority,
              notes: e.notes,
            }))
          : null,
        importantDates: caps.canViewPersonal
          ? importantDates.map((d) => ({
              id: d.id,
              title: d.title,
              startDate: d.startDate,
              endDate: d.endDate,
              priority: d.priority,
            }))
          : null,
        ...(caps.canEditAdminAccess || caps.canEditVisibilityOverrides
          ? {
              access: {
                adminAccess: employee.role === UserRole.Admin,
                accountRoleId: employee.userId
                  ? (
                      await this.users.findById(employee.userId)
                    )?.accountRoleId ?? null
                  : null,
                computedRole:
                  employee.role === UserRole.Admin
                    ? assignment?.isDepartmentManager ||
                      assignment?.managementKind === 'departments' ||
                      assignment?.managementKind === 'direction'
                      ? UserRole.DepartmentManager
                      : UserRole.Employee
                    : employee.role,
                profileVisibilityOverride: employee.profileVisibilityOverride,
                absenceVisibilityOverride: employee.absenceVisibilityOverride,
                showAbsenceTypeToPeersOverride:
                  this.peerTypeOverrideFromColumn(
                    employee.showAbsenceTypeToPeersOverride,
                  ),
              },
            }
          : {}),
      },
      capabilities: caps,
      completeness,
    };
  }

  async patchBasic(
    actor: User,
    id: string,
    dto: {
      firstName?: string;
      lastName?: string;
      middleName?: string | null;
      preferredName?: string | null;
      photoUrl?: string | null;
      employeeNumber?: string;
    },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    await this.access.requireCanEdit(actor, employee);
    const before = this.pickBasic(employee);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Employee);
      const row = await repo.findOneByOrFail({ id });
      if (dto.firstName !== undefined) row.firstName = dto.firstName.trim();
      if (dto.lastName !== undefined) row.lastName = dto.lastName.trim();
      if (dto.middleName !== undefined) {
        row.middleName = dto.middleName?.trim() || null;
      }
      if (dto.preferredName !== undefined) {
        row.preferredName = dto.preferredName?.trim() || null;
      }
      if (dto.photoUrl !== undefined) row.photoUrl = dto.photoUrl || null;
      if (dto.employeeNumber !== undefined) {
        const authz = await this.authorization.resolve(actor.id);
        if (!authz.isAdminEquivalent) {
          throw new ForbiddenException();
        }
        row.employeeNumber = dto.employeeNumber.trim();
      }
      await repo.save(row);
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.basic_updated',
          entityType: 'Employee',
          entityId: row.id,
          metadata: { before, after: this.pickBasic(row) },
        },
        manager,
      );
    });
    return this.getProfile(actor, id);
  }

  async patchPersonal(
    actor: User,
    id: string,
    dto: {
      birthDate?: string | null;
      city?: string | null;
      preferredLanguage?: string | null;
      preferredName?: string | null;
    },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditPersonal) {
      throw new BadRequestException('Cannot edit personal data');
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Employee);
      const row = await repo.findOneByOrFail({ id });
      if (dto.birthDate !== undefined) row.birthDate = dto.birthDate;
      if (dto.city !== undefined) row.city = dto.city?.trim() || null;
      if (dto.preferredLanguage !== undefined) {
        row.preferredLanguage = dto.preferredLanguage?.trim() || null;
      }
      if (dto.preferredName !== undefined) {
        row.preferredName = dto.preferredName?.trim() || null;
      }
      await repo.save(row);
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.personal_updated',
          entityType: 'Employee',
          entityId: row.id,
          metadata: { fields: Object.keys(dto) },
        },
        manager,
      );
    });
    return this.getProfile(actor, id);
  }

  async patchEmploymentMeta(
    actor: User,
    id: string,
    dto: { hiredAt?: string | null },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditEmployment) {
      throw new BadRequestException('Cannot edit employment metadata');
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Employee);
      const row = await repo.findOneOrFail({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (dto.hiredAt !== undefined) {
        row.hiredAt = this.parseOptionalDateOnly(dto.hiredAt);
      }
      await repo.save(row);
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.employment_meta_updated',
          entityType: 'Employee',
          entityId: row.id,
          metadata: { fields: Object.keys(dto) },
        },
        manager,
      );
    });

    return this.getProfile(actor, id);
  }

  async replacePersonalContacts(
    actor: User,
    employeeId: string,
    contacts: PersonalContactWriteInput[],
  ) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    const capabilities = await this.capabilities(actor, employee);
    if (!capabilities.canEditPersonal) {
      throw new BadRequestException('Cannot edit personal contacts');
    }

    for (const contact of contacts) {
      if (!isPersonalContactType(contact.type)) {
        throw new BadRequestException(
          `Invalid personal contact type: ${contact.type}`,
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await this.contactsFacade.replacePersonalContacts(
        manager,
        actor,
        employeeId,
        contacts,
      );
    });

    return this.getProfile(actor, employeeId);
  }

  async patchContacts(
    actor: User,
    id: string,
    dto: {
      workPhone?: string | null;
      workEmail?: string | null;
      workTelegram?: string | null;
    },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    await this.access.requireCanEdit(actor, employee);

    await this.dataSource.transaction(async (manager) => {
      const current = await this.contactsFacade.readContactsBundle(manager, id);
      await this.contactsFacade.applyWorkContacts(manager, actor, id, {
        email: dto.workEmail !== undefined ? dto.workEmail : current.work.email,
        phone: dto.workPhone !== undefined ? dto.workPhone : current.work.phone,
        telegram:
          dto.workTelegram !== undefined
            ? dto.workTelegram
            : current.work.telegram,
      });
    });
    return this.getProfile(actor, id);
  }

  async replaceEmergencyContacts(
    actor: User,
    employeeId: string,
    contacts: Array<{
      fullName: string;
      relationship?: string | null;
      primaryPhone: string;
      secondaryPhone?: string | null;
      notes?: string | null;
    }>,
  ) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    const capabilities = await this.capabilities(actor, employee);
    if (!capabilities.canEditEmergencyContact) {
      throw new BadRequestException('Cannot edit emergency contacts');
    }

    await this.dataSource.transaction(async (manager) => {
      await this.contactsFacade.replaceEmergencyContacts(
        manager,
        actor,
        employeeId,
        contacts.map((contact) => ({
          fullName: contact.fullName,
          relationship: contact.relationship ?? '',
          primaryPhone: contact.primaryPhone,
          secondaryPhone: contact.secondaryPhone ?? '',
          notes: contact.notes ?? '',
        })),
      );
    });

    return this.getProfile(actor, employeeId);
  }

  async replaceImportantDates(
    actor: User,
    employeeId: string,
    dates: Array<{
      title: string;
      startDate: string;
      endDate?: string | null;
    }>,
  ) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    const capabilities = await this.capabilities(actor, employee);
    if (!capabilities.canEditPersonal) {
      throw new BadRequestException('Cannot edit important dates');
    }

    for (const date of dates) {
      const start = date.startDate.trim();
      const end = date.endDate?.trim() || null;
      if (end && end < start) {
        throw new BadRequestException('endDate must be >= startDate');
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const employeeRepository = manager.getRepository(Employee);
      const datesRepository = manager.getRepository(EmployeeImportantDate);

      await employeeRepository.findOneOrFail({
        where: { id: employeeId },
        lock: { mode: 'pessimistic_write' },
      });

      const previous = await datesRepository.find({
        where: { employeeId, isActive: true },
      });

      await datesRepository.update(
        { employeeId, isActive: true },
        { isActive: false },
      );

      const rows = dates.map((date, index) =>
        datesRepository.create({
          employeeId,
          title: date.title.trim(),
          startDate: date.startDate.trim(),
          endDate: date.endDate?.trim() || null,
          priority: index + 1,
          isActive: true,
        }),
      );

      const saved = rows.length ? await datesRepository.save(rows) : [];

      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.important_dates_updated',
          entityType: 'Employee',
          entityId: employeeId,
          metadata: {
            previousCount: previous.length,
            count: saved.length,
            deactivatedIds: previous.map((row) => row.id),
            createdIds: saved.map((row) => row.id),
          },
        },
        manager,
      );
    });

    return this.getProfile(actor, employeeId);
  }

  private assignmentOrgTouched(dto: AssignmentWriteDto): boolean {
    return (
      dto.positionId !== undefined ||
      dto.departmentId !== undefined ||
      dto.directionId !== undefined
    );
  }

  private normalizeAssignmentDto(dto: AssignmentWriteDto): AssignmentWriteDto {
    return {
      ...dto,
      functionalRole: this.normalizeOptionalText(
        dto.functionalRole,
        120,
        'functionalRole',
      ),
      workLocation: this.normalizeOptionalText(
        dto.workLocation,
        255,
        'workLocation',
      ),
      workFormat: this.normalizeOptionalText(dto.workFormat, 64, 'workFormat'),
      employmentType: this.normalizeOptionalText(
        dto.employmentType,
        64,
        'employmentType',
      ),
      contractType: this.normalizeOptionalText(
        dto.contractType,
        64,
        'contractType',
      ),
      comment: this.normalizeOptionalText(
        dto.comment,
        5000,
        'comment',
      ),
      startDate:
        dto.startDate === undefined
          ? undefined
          : this.parseOptionalDateOnly(dto.startDate),
      endDate:
        dto.endDate === undefined ? undefined : this.parseOptionalDateOnly(dto.endDate),
      probationStartDate:
        dto.probationStartDate === undefined
          ? undefined
          : this.parseOptionalDateOnly(dto.probationStartDate),
      probationEndDate:
        dto.probationEndDate === undefined
          ? undefined
          : this.parseOptionalDateOnly(dto.probationEndDate),
    };
  }

  private async lockEmployeeForAssignmentMutation(
    manager: EntityManager,
    employeeId: string,
  ): Promise<Employee> {
    return manager.getRepository(Employee).findOneOrFail({
      where: { id: employeeId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async lockAssignmentForEmployee(
    manager: EntityManager,
    employeeId: string,
    assignmentId: string,
  ): Promise<EmploymentAssignment> {
    return manager.getRepository(EmploymentAssignment).findOneOrFail({
      where: { id: assignmentId, employeeId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async assertAssignmentCatalogValue(
    field: 'workFormat' | 'employmentType',
    nextValue: string | null | undefined,
    existingValue: string | null,
    mode: 'create' | 'update',
  ): Promise<string | null | undefined> {
    if (nextValue === undefined) {
      return undefined;
    }
    if (nextValue === null) {
      return null;
    }
    if (mode === 'update' && nextValue === existingValue) {
      return nextValue;
    }
    await this.employmentCatalogs.assertActiveValue(field, nextValue);
    return nextValue;
  }

  private syncEmployeeCurrentAssignment(
    employee: Employee,
    assignment: EmploymentAssignment | null,
  ): void {
    employee.currentAssignmentId = assignment?.id ?? null;
    employee.departmentId = assignment?.departmentId ?? null;
    employee.positionId = assignment?.positionId ?? null;
  }

  private assertAssignmentDateState(
    startDate: string | null,
    endDate: string | null,
    probationStartDate: string | null,
    probationEndDate: string | null,
    status: EmploymentAssignment['status'],
  ): void {
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be >= startDate');
    }
    if (startDate && probationEndDate && probationEndDate < startDate) {
      throw new BadRequestException('probationEndDate must be >= startDate');
    }
    if (probationStartDate && probationEndDate && probationEndDate < probationStartDate) {
      throw new BadRequestException(
        'probationEndDate must be >= probationStartDate',
      );
    }
    if (status === 'planned' && startDate == null) {
      throw new BadRequestException('Planned assignment must have startDate');
    }
    if ((status === 'active' || status === 'planned') && endDate != null) {
      throw new BadRequestException('Only ended assignments may have endDate');
    }
    if (status === 'ended' && endDate == null) {
      throw new BadRequestException('Ended assignment must have endDate');
    }
  }

  private activationRelevantTouched(dto: AssignmentWriteDto): boolean {
    return (
      dto.positionId !== undefined ||
      dto.departmentId !== undefined ||
      dto.directionId !== undefined ||
      dto.workFormat !== undefined ||
      dto.employmentType !== undefined ||
      dto.startDate !== undefined
    );
  }

  private async markPlannedActivationBlocked(
    manager: EntityManager,
    planned: EmploymentAssignment,
    reason:
      | 'employee_inactive'
      | 'company_inactive'
      | 'direction_inactive'
      | 'department_inactive'
      | 'position_inactive'
      | 'hierarchy_changed'
      | 'activation_date_conflict'
      | 'work_format_inactive'
      | 'employment_type_inactive',
  ): Promise<void> {
    planned.activationBlockedReason = reason;
    planned.activationCheckedAt = this.businessDateClock.now();
    await manager.getRepository(EmploymentAssignment).save(planned);
  }

  async activatePlannedAssignment(
    manager: EntityManager,
    employee: Employee,
    planned: EmploymentAssignment,
    actorId: string | null,
  ): Promise<boolean> {
    const assignmentRepo = manager.getRepository(EmploymentAssignment);
    const lockedPlanned = await assignmentRepo.findOne({
      where: { id: planned.id, employeeId: employee.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!lockedPlanned || lockedPlanned.status !== 'planned') {
      return false;
    }
    const today = this.businessDateClock.today();
    if (!lockedPlanned.startDate || lockedPlanned.startDate > today) {
      return false;
    }
    if (!employee.isActive) {
      await this.markPlannedActivationBlocked(
        manager,
        lockedPlanned,
        'employee_inactive',
      );
      return false;
    }

    const currentActive = await assignmentRepo.findOne({
      where: { employeeId: employee.id, status: 'active' },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      currentActive?.startDate != null &&
      lockedPlanned.startDate < currentActive.startDate
    ) {
      await this.markPlannedActivationBlocked(
        manager,
        lockedPlanned,
        'activation_date_conflict',
      );
      return false;
    }

    try {
      const resolved = await this.assignmentOrg.resolve(manager, {
        mode: 'update',
        effective: {
          positionId: lockedPlanned.positionId,
          departmentId: lockedPlanned.departmentId,
          directionId: lockedPlanned.directionId,
        },
        existing: {
          companyId: lockedPlanned.companyId,
          positionId: lockedPlanned.positionId,
          departmentId: lockedPlanned.departmentId,
          directionId: lockedPlanned.directionId,
        },
      });
      lockedPlanned.companyId = resolved.companyId;
      lockedPlanned.directionId = resolved.directionId;
      lockedPlanned.departmentId = resolved.departmentId;
      lockedPlanned.positionId = resolved.positionId;
      if (lockedPlanned.workFormat) {
        await this.employmentCatalogs.assertActiveValue(
          'workFormat',
          lockedPlanned.workFormat,
        );
      }
      if (lockedPlanned.employmentType) {
        await this.employmentCatalogs.assertActiveValue(
          'employmentType',
          lockedPlanned.employmentType,
        );
      }
    } catch (error) {
      if (error instanceof AssignmentHierarchyChangedDuringResolutionError) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message.toLowerCase() : 'unknown';
      const reason = message.includes('company')
        ? 'company_inactive'
        : message.includes('direction')
          ? 'direction_inactive'
          : message.includes('department')
            ? 'department_inactive'
            : message.includes('employment type')
              ? 'employment_type_inactive'
              : message.includes('work format')
                ? 'work_format_inactive'
                : message.includes('position')
                  ? 'position_inactive'
                  : 'hierarchy_changed';
      await this.markPlannedActivationBlocked(manager, lockedPlanned, reason);
      return false;
    }

    if (currentActive) {
      currentActive.status = 'ended';
      currentActive.endDate = lockedPlanned.startDate;
      await assignmentRepo.save(currentActive);
    }

    lockedPlanned.status = 'active';
    lockedPlanned.endDate = null;
    lockedPlanned.activationBlockedReason = null;
    lockedPlanned.activationCheckedAt = null;
    await assignmentRepo.save(lockedPlanned);
    this.syncEmployeeCurrentAssignment(employee, lockedPlanned);
    await manager.getRepository(Employee).save(employee);
    await this.identityRoleProjection.apply(manager, employee);
    await this.audit.record(
      {
        actorId,
        action: 'employee.assignment_activated',
        entityType: 'Employee',
        entityId: employee.id,
        metadata: { assignmentId: lockedPlanned.id },
      },
      manager,
    );
    return true;
  }

  async createAssignment(actor: User, id: string, dto: AssignmentWriteDto) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditEmployment) {
      throw new BadRequestException('Cannot change assignment');
    }
    const normalized = this.normalizeAssignmentDto(dto);
    if (normalized.managerEmployeeId && normalized.managerEmployeeId === id) {
      throw new BadRequestException('Manager cannot be the same employee');
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const employeeRepo = manager.getRepository(Employee);
          const assignmentRepo = manager.getRepository(EmploymentAssignment);
          const emp = await this.lockEmployeeForAssignmentMutation(manager, id);
          const today = this.businessDateClock.today();
          const status: EmploymentAssignment['status'] =
            normalized.startDate != null && normalized.startDate > today
              ? 'planned'
              : 'active';

          this.assertAssignmentDateState(
            normalized.startDate ?? null,
            null,
            normalized.probationStartDate ?? null,
            normalized.probationEndDate ?? null,
            status,
          );

          const resolved = await this.assignmentOrg.resolve(manager, {
            mode: 'create',
            effective: {
              positionId: normalized.positionId ?? null,
              departmentId: normalized.departmentId ?? null,
              directionId: normalized.directionId ?? null,
            },
            existing: null,
          });

          const { position, managedDepartmentIds: positionManagedDepartmentIds } =
            await loadPositionManagerTemplate(manager, resolved.positionId);
          const membership = resolveManagerMembershipForCreate({
            position,
            positionManagedDepartmentIds,
            explicitManagementKind: normalized.managementKind,
            explicitIsDepartmentManager: normalized.isDepartmentManager,
            explicitManagedDepartmentIds: normalized.managedDepartmentIds,
            assignmentDepartmentId: resolved.departmentId,
          });

          const workFormat = await this.assertAssignmentCatalogValue(
            'workFormat',
            normalized.workFormat,
            null,
            'create',
          );
          const employmentType = await this.assertAssignmentCatalogValue(
            'employmentType',
            normalized.employmentType,
            null,
            'create',
          );

          if (status === 'active') {
            const active = await assignmentRepo.findOne({
              where: { employeeId: id, status: 'active' },
              lock: { mode: 'pessimistic_write' },
            });
            if (active) {
              active.status = 'ended';
              active.endDate = normalized.startDate ?? today;
              await assignmentRepo.save(active);
            }
          } else {
            const planned = await assignmentRepo.findOne({
              where: { employeeId: id, status: 'planned' },
              lock: { mode: 'pessimistic_write' },
            });
            if (planned) {
              planned.status = 'ended';
              planned.endDate = today;
              await assignmentRepo.save(planned);
            }
          }

          const assignment = assignmentRepo.create({
            employeeId: id,
            companyId: resolved.companyId,
            directionId: resolved.directionId,
            departmentId: resolved.departmentId,
            positionId: resolved.positionId,
            functionalRole: normalized.functionalRole ?? null,
            managerEmployeeId: normalized.managerEmployeeId ?? null,
            mentorEmployeeId: normalized.mentorEmployeeId ?? null,
            hrResponsibleEmployeeId: normalized.hrResponsibleEmployeeId ?? null,
            workLocation: normalized.workLocation ?? null,
            workFormat: workFormat ?? null,
            employmentType: employmentType ?? null,
            contractType: normalized.contractType ?? null,
            startDate: normalized.startDate ?? null,
            endDate: null,
            probationStartDate: normalized.probationStartDate ?? null,
            probationEndDate: normalized.probationEndDate ?? null,
            comment: normalized.comment ?? null,
            status,
            managementKind: membership.managementKind,
            isDepartmentManager: membership.isDepartmentManager,
            activationBlockedReason: null,
            activationCheckedAt: null,
            createdByUserId: actor.id,
          });
          await assignmentRepo.save(assignment);
          await replaceAssignmentManagedDepartments(
            manager,
            assignment.id,
            membership.managedDepartmentIds,
          );

          if (status === 'active') {
            this.syncEmployeeCurrentAssignment(emp, assignment);
            await employeeRepo.save(emp);
            await this.identityRoleProjection.apply(manager, emp);
          }

          await this.audit.record(
            {
              actorId: actor.id,
              action: 'employee.assignment_changed',
              entityType: 'Employee',
              entityId: id,
              metadata: {
                assignmentId: assignment.id,
                status,
                comment: normalized.comment ?? null,
              },
            },
            manager,
          );
        });
        return this.getProfile(actor, id);
      } catch (error) {
        if (shouldRetryHierarchyDrift(error, attempt, 3)) {
          continue;
        }
        rethrowAssignmentWriteError(error);
      }
    }

    return this.getProfile(actor, id);
  }

  async updateAssignment(
    actor: User,
    employeeId: string,
    assignmentId: string,
    dto: AssignmentWriteDto,
  ) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditEmployment) {
      throw new BadRequestException('Cannot change assignment');
    }
    const normalized = this.normalizeAssignmentDto(dto);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const employeeRepo = manager.getRepository(Employee);
          const assignmentRepo = manager.getRepository(EmploymentAssignment);
          const emp = await this.lockEmployeeForAssignmentMutation(manager, employeeId);
          const row = await this.lockAssignmentForEmployee(
            manager,
            employeeId,
            assignmentId,
          );
          const today = this.businessDateClock.today();

          const nextManager =
            normalized.managerEmployeeId !== undefined
              ? normalized.managerEmployeeId
              : row.managerEmployeeId;
          if (nextManager && nextManager === employeeId) {
            throw new BadRequestException('Manager cannot be the same employee');
          }

          const orgTouched = this.assignmentOrgTouched(dto);
          const resolved = orgTouched
            ? await this.assignmentOrg.resolve(manager, {
                mode: 'update',
                effective: {
                  positionId:
                    normalized.positionId !== undefined
                      ? normalized.positionId
                      : row.positionId,
                  departmentId:
                    normalized.departmentId !== undefined
                      ? normalized.departmentId
                      : row.departmentId,
                  directionId:
                    normalized.directionId !== undefined
                      ? normalized.directionId
                      : row.directionId,
                },
                existing: {
                  companyId: row.companyId,
                  positionId: row.positionId,
                  departmentId: row.departmentId,
                  directionId: row.directionId,
                },
              })
            : {
                companyId: row.companyId,
                directionId: row.directionId,
                departmentId: row.departmentId,
                positionId: row.positionId,
              };

          const workFormat = await this.assertAssignmentCatalogValue(
            'workFormat',
            normalized.workFormat,
            row.workFormat,
            'update',
          );
          const employmentType = await this.assertAssignmentCatalogValue(
            'employmentType',
            normalized.employmentType,
            row.employmentType,
            'update',
          );

          if (
            row.status === 'active' &&
            normalized.startDate !== undefined &&
            normalized.startDate != null &&
            normalized.startDate > today
          ) {
            throw new BadRequestException(
              'Active assignment cannot be moved into the future',
            );
          }
          if (
            row.status === 'planned' &&
            normalized.startDate !== undefined &&
            normalized.startDate == null
          ) {
            throw new BadRequestException('Planned assignment must have startDate');
          }

          row.companyId = resolved.companyId;
          row.directionId = resolved.directionId;
          row.departmentId = resolved.departmentId;
          row.positionId = resolved.positionId;
          if (normalized.functionalRole !== undefined) {
            row.functionalRole = normalized.functionalRole;
          }
          if (normalized.managerEmployeeId !== undefined) {
            row.managerEmployeeId = normalized.managerEmployeeId;
          }
          if (normalized.mentorEmployeeId !== undefined) {
            row.mentorEmployeeId = normalized.mentorEmployeeId;
          }
          if (normalized.hrResponsibleEmployeeId !== undefined) {
            row.hrResponsibleEmployeeId = normalized.hrResponsibleEmployeeId;
          }
          if (normalized.workLocation !== undefined) {
            row.workLocation = normalized.workLocation;
          }
          if (workFormat !== undefined) {
            row.workFormat = workFormat;
          }
          if (employmentType !== undefined) {
            row.employmentType = employmentType;
          }
          if (normalized.contractType !== undefined) {
            row.contractType = normalized.contractType;
          }
          if (normalized.startDate !== undefined) {
            row.startDate = normalized.startDate;
          }
          if (normalized.probationStartDate !== undefined) {
            row.probationStartDate = normalized.probationStartDate;
          }
          if (normalized.probationEndDate !== undefined) {
            row.probationEndDate = normalized.probationEndDate;
          }
          if (normalized.comment !== undefined) {
            row.comment = normalized.comment;
          }

          const hasExplicitKind = normalized.managementKind !== undefined;
          const hasExplicitManager = normalized.isDepartmentManager !== undefined;
          const hasExplicitManagedDepts =
            normalized.managedDepartmentIds !== undefined;
          if (hasExplicitKind || hasExplicitManager || hasExplicitManagedDepts) {
            const wasManager = row.isDepartmentManager;
            if (hasExplicitKind) {
              row.managementKind = normalized.managementKind!;
              row.isDepartmentManager =
                normalized.managementKind !== 'none';
            } else if (hasExplicitManager) {
              row.isDepartmentManager = Boolean(normalized.isDepartmentManager);
              row.managementKind = row.isDepartmentManager
                ? 'departments'
                : 'none';
            }

            const explicitlyTogglingOn =
              (hasExplicitKind &&
                normalized.managementKind === 'departments' &&
                !wasManager) ||
              (hasExplicitManager &&
                normalized.isDepartmentManager === true &&
                !wasManager);

            if (row.managementKind !== 'departments') {
              await replaceAssignmentManagedDepartments(manager, row.id, []);
            } else if (hasExplicitManagedDepts) {
              let managedDepartmentIds = [
                ...new Set(
                  (normalized.managedDepartmentIds ?? []).filter(Boolean),
                ),
              ];
              if (
                managedDepartmentIds.length === 0 &&
                row.departmentId &&
                explicitlyTogglingOn
              ) {
                managedDepartmentIds = [row.departmentId];
              }
              await replaceAssignmentManagedDepartments(
                manager,
                row.id,
                managedDepartmentIds,
              );
            } else if (explicitlyTogglingOn) {
              await replaceAssignmentManagedDepartments(
                manager,
                row.id,
                row.departmentId ? [row.departmentId] : [],
              );
            }
          }

          if (row.status === 'ended') {
            if (normalized.endDate !== undefined) {
              row.endDate = normalized.endDate;
            }
          } else {
            row.endDate = null;
          }

          if (row.status === 'planned' && this.activationRelevantTouched(dto)) {
            row.activationBlockedReason = null;
            row.activationCheckedAt = null;
          }

          this.assertAssignmentDateState(
            row.startDate,
            row.endDate,
            row.probationStartDate,
            row.probationEndDate,
            row.status,
          );

          await assignmentRepo.save(row);

          if (row.status === 'planned' && row.startDate != null && row.startDate <= today) {
            await this.activatePlannedAssignment(manager, emp, row, actor.id);
          } else if (row.status === 'active') {
            this.syncEmployeeCurrentAssignment(emp, row);
            await employeeRepo.save(emp);
            await this.identityRoleProjection.apply(manager, emp);
          }

          await this.audit.record(
            {
              actorId: actor.id,
              action: 'employee.assignment_updated',
              entityType: 'Employee',
              entityId: employeeId,
              metadata: { assignmentId },
            },
            manager,
          );
        });
        return this.getProfile(actor, employeeId);
      } catch (error) {
        if (shouldRetryHierarchyDrift(error, attempt, 3)) {
          continue;
        }
        rethrowAssignmentWriteError(error);
      }
    }

    return this.getProfile(actor, employeeId);
  }

  async deleteAssignment(actor: User, employeeId: string, assignmentId: string) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditEmployment) {
      throw new BadRequestException('Cannot change assignment');
    }

    await this.dataSource.transaction(async (manager) => {
      await this.lockEmployeeForAssignmentMutation(manager, employeeId);
      const assignmentRepo = manager.getRepository(EmploymentAssignment);
      const existing = await this.lockAssignmentForEmployee(
        manager,
        employeeId,
        assignmentId,
      );
      if (existing.status === 'active') {
        throw new BadRequestException(
          'Cannot delete active assignment; create a new assignment instead',
        );
      }
      await assignmentRepo.delete({ id: assignmentId, employeeId });
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.assignment_deleted',
          entityType: 'Employee',
          entityId: employeeId,
          metadata: { assignmentId, status: existing.status },
        },
        manager,
      );
    });

    return this.getProfile(actor, employeeId);
  }

  private assertAssignmentDates(
    dto: AssignmentWriteDto,
    status: string,
  ): void {
    const start = dto.startDate ?? null;
    const end = dto.endDate ?? null;
    const probation = dto.probationEndDate ?? null;
    if (start && end && end < start) {
      throw new BadRequestException('endDate must be >= startDate');
    }
    if (start && probation && probation < start) {
      throw new BadRequestException('probationEndDate must be >= startDate');
    }
    if (status === 'ended' && end === null && dto.endDate === null) {
      // only enforce when explicitly clearing or creating as ended
    }
  }

  async employmentHistory(actor: User, id: string) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!(await this.access.canViewEmployeeProfile(actor, employee))) {
      throw new NotFoundException('Employee not found');
    }
    const rows = await this.assignments.find({
      where: { employeeId: id },
      relations: [
        'department',
        'position',
        'company',
        'direction',
        'managedDepartments',
      ],
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((a) => ({
      id: a.id,
      status: a.status,
      companyId: a.companyId,
      directionId: a.directionId,
      departmentId: a.departmentId,
      positionId: a.positionId,
      functionalRole: a.functionalRole,
      managerEmployeeId: a.managerEmployeeId,
      mentorEmployeeId: a.mentorEmployeeId,
      hrResponsibleEmployeeId: a.hrResponsibleEmployeeId,
      workLocation: a.workLocation,
      workFormat: a.workFormat,
      employmentType: a.employmentType,
      contractType: a.contractType,
      startDate: a.startDate,
      endDate: a.endDate,
      probationStartDate: a.probationStartDate,
      probationEndDate: a.probationEndDate,
      comment: a.comment,
      isDepartmentManager: Boolean(a.isDepartmentManager),
      managedDepartmentIds: (a.managedDepartments ?? []).map(
        (row) => row.departmentId,
      ),
      activationBlockedReason: a.activationBlockedReason,
      activationCheckedAt: a.activationCheckedAt
        ? a.activationCheckedAt.toISOString()
        : null,
      updatedAt: a.updatedAt.toISOString(),
      department: a.department
        ? { id: a.department.id, name: a.department.name }
        : null,
      position: a.position
        ? { id: a.position.id, name: a.position.name }
        : null,
      company: a.company ? { id: a.company.id, name: a.company.name } : null,
      direction: a.direction
        ? { id: a.direction.id, name: a.direction.name }
        : null,
    }));
  }

  async transitionStatus(
    actor: User,
    id: string,
    dto: { status: string; reason?: string | null },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canChangeStatus) {
      throw new BadRequestException('Cannot change employment status');
    }
    const before = employee.employmentStatus;

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Employee);
      const row = await repo.findOneByOrFail({ id });
      row.employmentStatus = dto.status;
      row.isActive = !['dismissed', 'archived', 'suspended'].includes(dto.status);
      row.archivedAt = row.isActive ? null : new Date();
      await repo.save(row);
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.status_changed',
          entityType: 'Employee',
          entityId: id,
          metadata: { before, after: dto.status, reason: dto.reason ?? null },
        },
        manager,
      );
    });
    return this.getProfile(actor, id);
  }

  async history(actor: User, id: string, limit = 50) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canViewHistory) {
      throw new NotFoundException('Employee not found');
    }
    const take = Math.min(Math.max(1, limit), 100);
    const rows = await this.auditLogs.find({
      where: { entityType: 'Employee', entityId: id },
      order: { createdAt: 'DESC' },
      take,
    });

    const actorIds = [
      ...new Set(
        rows
          .map((r) => r.actorUserId)
          .filter((uid): uid is string => Boolean(uid)),
      ),
    ];
    const users = await this.users.findByIds(actorIds);
    const usersById = new Map(users.map((u) => [u.id, { email: u.email }]));

    const linkedEmployees =
      actorIds.length === 0
        ? []
        : await this.employees.find({
            where: { userId: In(actorIds) },
          });
    const employeesByUserId = new Map(
      linkedEmployees
        .filter((e) => e.userId)
        .map((e) => [
          e.userId as string,
          { fullName: this.serializer.fullName(e) },
        ]),
    );

    return rows.map((r) => {
      const redacted = this.redactMetadata(r.metadata, caps);
      const actorResolved = resolveHistoryActorLabel({
        actorUserId: r.actorUserId,
        usersById,
        employeesByUserId,
      });
      return projectEmployeeHistoryItem({
        auditLog: {
          id: r.id,
          action: r.action,
          actorUserId: r.actorUserId,
          createdAt: r.createdAt,
        },
        actor: actorResolved,
        redactedMetadata: redacted,
      });
    });
  }

  async completeness(actor: User, id: string) {
    const profile = await this.getProfile(actor, id);
    return profile.completeness;
  }

  async listCatalogs() {
    const [companies, directions, departments, positions, workFormats, employmentTypes] =
      await Promise.all([
        this.companies.find({ order: { name: 'ASC' } }),
        this.directions.find({ order: { name: 'ASC' } }),
        this.departmentsService.findAll(),
        this.positions.findAll({ all: true }),
        this.employmentCatalogs.listWorkFormats(false),
        this.employmentCatalogs.listEmploymentTypes(false),
      ]);
    const companiesById = new Map(companies.map((row) => [row.id, row]));
    const directionsById = new Map(directions.map((row) => [row.id, row]));
    const departmentsById = new Map(departments.map((row) => [row.id, row]));
    const selectableDirections = directions.filter((direction) =>
      isDirectionSelectable({
        direction,
        company:
          direction.companyId != null
            ? companiesById.get(direction.companyId) ?? null
            : null,
      }),
    );
    const selectableDepartments = departments.filter((department) =>
      isDepartmentSelectable({
        department,
        direction:
          department.directionId != null
            ? directionsById.get(department.directionId) ?? null
            : null,
        company:
          department.directionId != null
            ? companiesById.get(
                directionsById.get(department.directionId)?.companyId ?? '',
              ) ?? null
            : null,
      }),
    );
    const selectablePositions = positions.filter((position) =>
      isPositionSelectable({
        position,
        department:
          position.departmentId != null
            ? departmentsById.get(position.departmentId) ?? null
            : null,
        direction:
          position.directionId != null
            ? directionsById.get(position.directionId) ?? null
            : null,
        company:
          position.directionId != null
            ? companiesById.get(
                directionsById.get(position.directionId)?.companyId ?? '',
              ) ?? null
            : null,
      }),
    );
    return {
      companies: companies
        .filter((c) => c.isActive)
        .map((c) => ({ id: c.id, name: c.name, code: c.code })),
      directions: selectableDirections.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        companyId: d.companyId,
      })),
      departments: selectableDepartments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        location: d.location,
        directionId: d.directionId,
        directionName: d.directionName,
      })),
      positions: selectablePositions.map((p) => ({
        id: p.id,
        name: p.name,
        departmentId: p.departmentId,
        directionId: p.directionId,
        departmentName: p.departmentName,
        directionName: p.directionName,
        managementKindTemplate: p.managementKindTemplate ?? 'none',
      })),
      workFormats: workFormats.map((row) => ({
        id: row.id,
        name: row.name,
        sortOrder: row.sortOrder,
      })),
      employmentTypes: employmentTypes.map((row) => ({
        id: row.id,
        name: row.name,
        sortOrder: row.sortOrder,
      })),
    };
  }

  private async upsertContact(
    employeeId: string,
    type: EmployeeContact['type'],
    value: string | null,
    visibility: EmployeeContact['visibility'],
    manager?: EntityManager,
  ) {
    const contacts = manager
      ? manager.getRepository(EmployeeContact)
      : this.contacts;
    const existing = await contacts.findOne({
      where: { employeeId, type },
    });
    if (!value) {
      if (existing) await contacts.remove(existing);
      return;
    }
    if (existing) {
      existing.value = value;
      existing.visibility = visibility;
      existing.isPrimary = true;
      await contacts.save(existing);
      return;
    }
    await contacts.save(
      contacts.create({
        employeeId,
        type,
        value,
        visibility,
        isPrimary: true,
      }),
    );
  }

  private pickBasic(e: Employee) {
    return {
      firstName: e.firstName,
      lastName: e.lastName,
      middleName: e.middleName,
      preferredName: e.preferredName,
      employeeNumber: e.employeeNumber,
      photoUrl: e.photoUrl,
    };
  }

  private peerTypeOverrideFromColumn(
    value: string | null | undefined,
  ): boolean | null {
    if (value == null || value === '') return null;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return null;
  }

  private redactMetadata(
    metadata: Record<string, unknown> | null,
    caps: ProfileCapabilities,
  ): Record<string, unknown> | null {
    if (!metadata) return null;
    if (caps.canViewPersonal && caps.canViewEmergencyContact) return metadata;
    const copy = { ...metadata };
    if (!caps.canViewPersonal) {
      delete copy['personal'];
      delete copy['before'];
      delete copy['after'];
    }
    return { ...copy, redacted: !caps.canViewPersonal };
  }
}
