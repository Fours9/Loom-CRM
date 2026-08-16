import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UsersService } from '../../platform/identity/users.service';
import { AuditService } from '../../platform/audit/audit.service';
import { permissionsForRole } from '../../platform/permissions/role-permissions';
import { Permission } from '../../platform/permissions/permission.names';
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
  legacyPersonalFromContacts,
  normalizePersonalContactsForWrite,
  PERSONAL_CONTACT_TYPES,
  resolvePrimaryPersonalValue,
  type PersonalContactWriteInput,
} from './employee-personal-contacts';
import { EmployeeContactsFacade } from './employee-contacts.facade';
import { PositionsService } from '../positions/positions.service';
import { Position } from '../positions/position.entity';

type AssignmentWriteDto = {
  companyId?: string | null;
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
  probationEndDate?: string | null;
  changeReason?: string | null;
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
    private readonly positions: PositionsService,
  ) {}

  private hasPerm(user: User, perm: Permission): boolean {
    return permissionsForRole(user.role).includes(perm);
  }

  /**
   * Hierarchy: Position → optional Department → optional Direction on dept;
   * Position.directionId is stored: inherited from dept when dept set, else manual.
   * Assignment must match position.departmentId / position.directionId when set.
   */
  private async applyPositionAssignmentInvariant(input: {
    positionId: string | null;
    departmentId: string | null;
    directionId: string | null;
  }): Promise<{
    positionId: string | null;
    departmentId: string | null;
    directionId: string | null;
  }> {
    if (!input.positionId) {
      return input;
    }
    const position: Position = await this.positions.getOrFail(input.positionId);
    let { departmentId, directionId } = input;

    if (position.departmentId != null) {
      if (
        departmentId != null &&
        departmentId !== position.departmentId
      ) {
        throw new BadRequestException(
          'Assignment departmentId must match position.departmentId',
        );
      }
      departmentId = position.departmentId;
    }

    if (position.directionId != null) {
      if (directionId != null && directionId !== position.directionId) {
        throw new BadRequestException(
          'Assignment directionId must match position.directionId',
        );
      }
      directionId = position.directionId;
    }

    return {
      positionId: input.positionId,
      departmentId,
      directionId,
    };
  }

  async capabilities(actor: User, target: Employee): Promise<ProfileCapabilities> {
    const canEdit = await this.access.canEditEmployeeProfile(actor, target);
    const canView = await this.access.canViewEmployeeProfile(actor, target);
    const owner = this.access.isOwner(actor, target);
    const admin = this.access.isAdmin(actor);
    return {
      canEditBasic: canEdit,
      canEditEmployment:
        canEdit &&
        (admin || this.hasPerm(actor, Permission.EmployeesChangeAssignment)),
      canViewPersonal:
        admin ||
        owner ||
        this.hasPerm(actor, Permission.EmployeesReadPersonal),
      canEditPersonal:
        admin || this.hasPerm(actor, Permission.EmployeesWritePersonal),
      canViewEmergencyContact:
        admin ||
        owner ||
        this.hasPerm(actor, Permission.EmployeesReadEmergency),
      canEditEmergencyContact:
        admin ||
        owner ||
        this.hasPerm(actor, Permission.EmployeesWriteEmergency),
      canChangeStatus:
        admin || this.hasPerm(actor, Permission.EmployeesChangeStatus),
      canExport: await this.access.canExportProfilePdf(actor, target),
      canViewHistory:
        admin ||
        this.hasPerm(actor, Permission.EmployeesViewHistory) ||
        (canView && this.access.isManager(actor)),
      canStartOnboarding: false,
      canAssignQuestionnaire:
        this.hasPerm(actor, Permission.QuestionnairesAssign) && canView,
    };
  }

  /** Owner + Admin may see extended completeness; managers on others get null. */
  private canViewExtendedCompleteness(actor: User, target: Employee): boolean {
    return this.access.isAdmin(actor) || this.access.isOwner(actor, target);
  }

  async getProfile(actor: User, id: string) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!(await this.access.canViewEmployeeProfile(actor, employee))) {
      throw new NotFoundException('Employee not found');
    }

    const caps = await this.capabilities(actor, employee);

    // Completeness facts: always load full rows (role-independent score).
    const [contacts, emergencyAll, importantDatesAll, assignment] =
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
        employee.currentAssignmentId
          ? this.assignments.findOne({
              where: { id: employee.currentAssignmentId },
              relations: ['department', 'position', 'company', 'direction'],
            })
          : this.assignments.findOne({
              where: { employeeId: id, status: 'active' },
              relations: ['department', 'position', 'company', 'direction'],
            }),
      ]);

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
      this.canViewExtendedCompleteness(actor, employee),
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
        hiredAt: assignment?.startDate ?? null,
        accountCreatedAt: employee.user?.createdAt
          ? employee.user.createdAt.toISOString()
          : null,
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
              probationEndDate: assignment.probationEndDate,
              status: assignment.status,
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
      if (dto.employeeNumber !== undefined && this.access.isAdmin(actor)) {
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

  async createAssignment(actor: User, id: string, dto: AssignmentWriteDto) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditEmployment) {
      throw new BadRequestException('Cannot change assignment');
    }
    this.assertAssignmentDates(dto, 'active');
    if (dto.managerEmployeeId && dto.managerEmployeeId === id) {
      throw new BadRequestException('Manager cannot be the same employee');
    }

    const resolved = await this.applyPositionAssignmentInvariant({
      positionId: dto.positionId ?? null,
      departmentId: dto.departmentId ?? null,
      directionId: dto.directionId ?? null,
    });

    await this.dataSource.transaction(async (manager) => {
      const employeeRepo = manager.getRepository(Employee);
      const assignmentRepo = manager.getRepository(EmploymentAssignment);
      const emp = await employeeRepo.findOneByOrFail({ id });

      await assignmentRepo.update(
        { employeeId: id, status: 'active' },
        { status: 'ended', endDate: dto.startDate ?? new Date().toISOString().slice(0, 10) },
      );

      const assignment = assignmentRepo.create({
        employeeId: id,
        companyId: dto.companyId ?? null,
        directionId: resolved.directionId,
        departmentId: resolved.departmentId,
        positionId: resolved.positionId,
        functionalRole: dto.functionalRole ?? null,
        managerEmployeeId: dto.managerEmployeeId ?? null,
        mentorEmployeeId: dto.mentorEmployeeId ?? null,
        hrResponsibleEmployeeId: dto.hrResponsibleEmployeeId ?? null,
        workLocation: dto.workLocation ?? null,
        workFormat: dto.workFormat ?? null,
        employmentType: dto.employmentType ?? null,
        contractType: dto.contractType ?? null,
        startDate: dto.startDate ?? null,
        endDate: null,
        probationEndDate: dto.probationEndDate ?? null,
        changeReason: dto.changeReason ?? null,
        status: 'active',
        createdByUserId: actor.id,
      });
      await assignmentRepo.save(assignment);

      emp.currentAssignmentId = assignment.id;
      emp.departmentId = assignment.departmentId;
      emp.positionId = assignment.positionId;
      await employeeRepo.save(emp);

      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.assignment_changed',
          entityType: 'Employee',
          entityId: id,
          metadata: { assignmentId: assignment.id, changeReason: dto.changeReason },
        },
        manager,
      );
    });

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

    const existing = await this.assignments.findOne({
      where: { id: assignmentId, employeeId },
    });
    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }

    const nextManager =
      dto.managerEmployeeId !== undefined
        ? dto.managerEmployeeId
        : existing.managerEmployeeId;
    if (nextManager && nextManager === employeeId) {
      throw new BadRequestException('Manager cannot be the same employee');
    }

    const merged: AssignmentWriteDto = {
      startDate: dto.startDate !== undefined ? dto.startDate : existing.startDate,
      endDate: dto.endDate !== undefined ? dto.endDate : existing.endDate,
      probationEndDate:
        dto.probationEndDate !== undefined
          ? dto.probationEndDate
          : existing.probationEndDate,
    };
    this.assertAssignmentDates(merged, existing.status);

    const resolved = await this.applyPositionAssignmentInvariant({
      positionId:
        dto.positionId !== undefined ? dto.positionId : existing.positionId,
      departmentId:
        dto.departmentId !== undefined
          ? dto.departmentId
          : existing.departmentId,
      directionId:
        dto.directionId !== undefined ? dto.directionId : existing.directionId,
    });

    await this.dataSource.transaction(async (manager) => {
      const employeeRepo = manager.getRepository(Employee);
      const assignmentRepo = manager.getRepository(EmploymentAssignment);
      const row = await assignmentRepo.findOneByOrFail({
        id: assignmentId,
        employeeId,
      });

      if (dto.companyId !== undefined) row.companyId = dto.companyId;
      row.directionId = resolved.directionId;
      row.departmentId = resolved.departmentId;
      row.positionId = resolved.positionId;
      if (dto.functionalRole !== undefined) row.functionalRole = dto.functionalRole;
      if (dto.managerEmployeeId !== undefined) {
        row.managerEmployeeId = dto.managerEmployeeId;
      }
      if (dto.mentorEmployeeId !== undefined) row.mentorEmployeeId = dto.mentorEmployeeId;
      if (dto.hrResponsibleEmployeeId !== undefined) {
        row.hrResponsibleEmployeeId = dto.hrResponsibleEmployeeId;
      }
      if (dto.workLocation !== undefined) row.workLocation = dto.workLocation;
      if (dto.workFormat !== undefined) row.workFormat = dto.workFormat;
      if (dto.employmentType !== undefined) row.employmentType = dto.employmentType;
      if (dto.contractType !== undefined) row.contractType = dto.contractType;
      if (dto.startDate !== undefined) row.startDate = dto.startDate;
      if (dto.endDate !== undefined) row.endDate = dto.endDate;
      if (dto.probationEndDate !== undefined) {
        row.probationEndDate = dto.probationEndDate;
      }
      if (dto.changeReason !== undefined) row.changeReason = dto.changeReason;

      if (row.status === 'ended' && !row.endDate) {
        throw new BadRequestException('Ended assignment must have endDate');
      }
      if (row.status === 'active' && row.endDate) {
        const today = new Date().toISOString().slice(0, 10);
        if (row.endDate < today) {
          throw new BadRequestException('Active assignment cannot have a past endDate');
        }
      }

      await assignmentRepo.save(row);

      if (row.status === 'active') {
        const emp = await employeeRepo.findOneByOrFail({ id: employeeId });
        emp.currentAssignmentId = row.id;
        emp.departmentId = row.departmentId;
        emp.positionId = row.positionId;
        await employeeRepo.save(emp);
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
  }

  async deleteAssignment(actor: User, employeeId: string, assignmentId: string) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditEmployment) {
      throw new BadRequestException('Cannot change assignment');
    }

    const existing = await this.assignments.findOne({
      where: { id: assignmentId, employeeId },
    });
    if (!existing) {
      throw new NotFoundException('Assignment not found');
    }
    if (existing.status === 'active') {
      throw new BadRequestException(
        'Cannot delete active assignment; create a new assignment instead',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const assignmentRepo = manager.getRepository(EmploymentAssignment);
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
      relations: ['department', 'position', 'company', 'direction'],
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
      probationEndDate: a.probationEndDate,
      changeReason: a.changeReason,
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
    const [companies, directions] = await Promise.all([
      this.companies.find({ where: { isActive: true }, order: { name: 'ASC' } }),
      this.directions.find({ where: { isActive: true }, order: { name: 'ASC' } }),
    ]);
    return {
      companies: companies.map((c) => ({ id: c.id, name: c.name, code: c.code })),
      directions: directions.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
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
