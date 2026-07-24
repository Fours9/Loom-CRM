import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { AuditService } from '../../platform/audit/audit.service';
import { permissionsForRole } from '../../platform/permissions/role-permissions';
import { Permission } from '../../platform/permissions/permission.names';
import { EmployeeAccessService } from '../access/employee-access.service';
import { Employee } from './employee.entity';
import { EmployeeContact } from './employee-contact.entity';
import { EmployeeEmergencyContact } from './employee-emergency-contact.entity';
import { EmploymentAssignment } from './employment-assignment.entity';
import { Company } from '../companies/company.entity';
import { Direction } from '../companies/direction.entity';
import { EmployeeSerializer } from './employee.serializer';
import { AuditLog } from '../../platform/audit/audit-log.entity';

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
  ) {}

  private hasPerm(user: User, perm: Permission): boolean {
    return permissionsForRole(user.role).includes(perm);
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
        admin || this.hasPerm(actor, Permission.EmployeesReadEmergency),
      canEditEmergencyContact:
        admin || this.hasPerm(actor, Permission.EmployeesWriteEmergency),
      canChangeStatus:
        admin || this.hasPerm(actor, Permission.EmployeesChangeStatus),
      canExport: await this.access.canExportProfilePdf(actor, target),
      canViewHistory:
        admin ||
        this.hasPerm(actor, Permission.EmployeesViewHistory) ||
        (canView && this.access.isManager(actor)),
      canStartOnboarding: false,
      canAssignQuestionnaire: false,
    };
  }

  computeCompleteness(input: {
    employee: Employee;
    contacts: EmployeeContact[];
    emergency: EmployeeEmergencyContact[];
    assignment: EmploymentAssignment | null;
  }): {
    percent: number;
    missingFields: string[];
    sections: Record<string, { weight: number; complete: boolean }>;
  } {
    const { employee: e, contacts, emergency, assignment } = input;
    const workPhone = contacts.some((c) => c.type === 'work_phone' && c.value);
    const workEmail =
      contacts.some((c) => c.type === 'work_email' && c.value) ||
      Boolean(e.workEmail);
    const personalPhone = contacts.some(
      (c) => c.type === 'personal_phone' && c.value,
    );
    const sections = {
      identity: {
        weight: 15,
        complete: Boolean(e.firstName && e.lastName && e.employeeNumber),
      },
      assignment: {
        weight: 20,
        complete: Boolean(
          assignment && (assignment.departmentId || assignment.positionId),
        ),
      },
      workContacts: {
        weight: 10,
        complete: workPhone || workEmail,
      },
      personalContacts: {
        weight: 10,
        complete: personalPhone || Boolean(e.personalPhoneNumber),
      },
      emergency: {
        weight: 10,
        complete: emergency.length > 0,
      },
      photo: {
        weight: 5,
        complete: Boolean(e.photoUrl),
      },
      personalCore: {
        weight: 15,
        complete: Boolean(e.birthDate && e.city),
      },
      employmentDates: {
        weight: 15,
        complete: Boolean(assignment?.startDate),
      },
    };

    const missingFields: string[] = [];
    if (!sections.identity.complete) missingFields.push('identity');
    if (!sections.assignment.complete) missingFields.push('assignment');
    if (!sections.workContacts.complete) missingFields.push('workContacts');
    if (!sections.personalContacts.complete) {
      missingFields.push('personalContacts');
    }
    if (!sections.emergency.complete) missingFields.push('emergency');
    if (!sections.photo.complete) missingFields.push('photo');
    if (!sections.personalCore.complete) missingFields.push('birthDate|city');
    if (!sections.employmentDates.complete) missingFields.push('startDate');

    let earned = 0;
    let total = 0;
    for (const s of Object.values(sections)) {
      total += s.weight;
      if (s.complete) earned += s.weight;
    }
    return {
      percent: total === 0 ? 0 : Math.round((earned / total) * 100),
      missingFields,
      sections,
    };
  }

  async getProfile(actor: User, id: string) {
    const employee = await this.access.getEmployeeOrFail(id);
    if (!(await this.access.canViewEmployeeProfile(actor, employee))) {
      throw new NotFoundException('Employee not found');
    }

    const caps = await this.capabilities(actor, employee);
    const contacts = await this.contacts.find({
      where: { employeeId: id },
      order: { type: 'ASC' },
    });
    const emergency = caps.canViewEmergencyContact
      ? await this.emergencies.find({
          where: { employeeId: id, isActive: true },
          order: { priority: 'ASC' },
        })
      : [];
    const assignment = employee.currentAssignmentId
      ? await this.assignments.findOne({
          where: { id: employee.currentAssignmentId },
          relations: ['department', 'position', 'company', 'direction'],
        })
      : await this.assignments.findOne({
          where: { employeeId: id, status: 'active' },
          relations: ['department', 'position', 'company', 'direction'],
        });

    const completeness = this.computeCompleteness({
      employee,
      contacts,
      emergency,
      assignment,
    });

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
        workEmail: employee.workEmail,
        workPhone: employee.phoneNumber,
        workTelegram: employee.telegram,
        completenessPercent: completeness.percent,
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
          ? {
              birthDate: employee.birthDate,
              city: employee.city,
              preferredLanguage: employee.preferredLanguage,
              preferredName: employee.preferredName,
              personalPhone: employee.personalPhoneNumber,
              personalEmail: employee.personalEmail,
              personalTelegram: employee.personalTelegram,
            }
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
    const before = { ...employee };
    if (dto.firstName !== undefined) employee.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) employee.lastName = dto.lastName.trim();
    if (dto.middleName !== undefined) {
      employee.middleName = dto.middleName?.trim() || null;
    }
    if (dto.preferredName !== undefined) {
      employee.preferredName = dto.preferredName?.trim() || null;
    }
    if (dto.photoUrl !== undefined) employee.photoUrl = dto.photoUrl || null;
    if (dto.employeeNumber !== undefined && this.access.isAdmin(actor)) {
      employee.employeeNumber = dto.employeeNumber.trim();
    }
    await this.employees.save(employee);
    await this.audit.record({
      actorId: actor.id,
      action: 'employee.basic_updated',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { before: this.pickBasic(before), after: this.pickBasic(employee) },
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
      personalPhone?: string | null;
      personalEmail?: string | null;
      personalTelegram?: string | null;
    },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditPersonal) {
      throw new BadRequestException('Cannot edit personal data');
    }
    if (dto.birthDate !== undefined) employee.birthDate = dto.birthDate;
    if (dto.city !== undefined) employee.city = dto.city?.trim() || null;
    if (dto.preferredLanguage !== undefined) {
      employee.preferredLanguage = dto.preferredLanguage?.trim() || null;
    }
    if (dto.preferredName !== undefined) {
      employee.preferredName = dto.preferredName?.trim() || null;
    }
    if (dto.personalPhone !== undefined) {
      employee.personalPhoneNumber = dto.personalPhone?.trim() || null;
      await this.upsertContact(id, 'personal_phone', employee.personalPhoneNumber, 'personal');
    }
    if (dto.personalEmail !== undefined) {
      employee.personalEmail = dto.personalEmail?.trim() || null;
      await this.upsertContact(id, 'personal_email', employee.personalEmail, 'personal');
    }
    if (dto.personalTelegram !== undefined) {
      employee.personalTelegram = dto.personalTelegram?.trim() || null;
      await this.upsertContact(
        id,
        'personal_telegram',
        employee.personalTelegram,
        'personal',
      );
    }
    await this.employees.save(employee);
    await this.audit.record({
      actorId: actor.id,
      action: 'employee.personal_updated',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.getProfile(actor, id);
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
    if (dto.workPhone !== undefined) {
      employee.phoneNumber = dto.workPhone?.trim() || null;
      await this.upsertContact(id, 'work_phone', employee.phoneNumber, 'work');
    }
    if (dto.workEmail !== undefined) {
      employee.workEmail = dto.workEmail?.trim() || null;
      await this.upsertContact(id, 'work_email', employee.workEmail, 'work');
    }
    if (dto.workTelegram !== undefined) {
      employee.telegram = dto.workTelegram?.trim() || null;
      await this.upsertContact(id, 'work_telegram', employee.telegram, 'work');
    }
    await this.employees.save(employee);
    await this.audit.record({
      actorId: actor.id,
      action: 'employee.contacts_updated',
      entityType: 'Employee',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.getProfile(actor, id);
  }

  async replaceEmergency(
    actor: User,
    id: string,
    dto: {
      fullName: string;
      relationship?: string | null;
      primaryPhone: string;
      secondaryPhone?: string | null;
      notes?: string | null;
    },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditEmergencyContact) {
      throw new BadRequestException('Cannot edit emergency contact');
    }
    await this.emergencies.update(
      { employeeId: id, isActive: true },
      { isActive: false },
    );
    const row = this.emergencies.create({
      employeeId: id,
      fullName: dto.fullName.trim(),
      relationship: dto.relationship?.trim() || null,
      primaryPhone: dto.primaryPhone.trim(),
      secondaryPhone: dto.secondaryPhone?.trim() || null,
      notes: dto.notes?.trim() || null,
      priority: 1,
      isActive: true,
    });
    await this.emergencies.save(row);
    await this.audit.record({
      actorId: actor.id,
      action: 'employee.emergency_updated',
      entityType: 'Employee',
      entityId: id,
      metadata: { emergencyContactId: row.id },
    });
    return this.getProfile(actor, id);
  }

  async createAssignment(
    actor: User,
    id: string,
    dto: {
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
      probationEndDate?: string | null;
      changeReason?: string | null;
    },
  ) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canEditEmployment) {
      throw new BadRequestException('Cannot change assignment');
    }
    if (dto.managerEmployeeId && dto.managerEmployeeId === id) {
      throw new BadRequestException('Manager cannot be the same employee');
    }

    await this.assignments.update(
      { employeeId: id, status: 'active' },
      { status: 'ended', endDate: dto.startDate ?? new Date().toISOString().slice(0, 10) },
    );

    const assignment = this.assignments.create({
      employeeId: id,
      companyId: dto.companyId ?? null,
      directionId: dto.directionId ?? null,
      departmentId: dto.departmentId ?? null,
      positionId: dto.positionId ?? null,
      functionalRole: dto.functionalRole ?? null,
      managerEmployeeId: dto.managerEmployeeId ?? null,
      mentorEmployeeId: dto.mentorEmployeeId ?? null,
      hrResponsibleEmployeeId: dto.hrResponsibleEmployeeId ?? null,
      workLocation: dto.workLocation ?? null,
      workFormat: dto.workFormat ?? null,
      employmentType: dto.employmentType ?? null,
      contractType: dto.contractType ?? null,
      startDate: dto.startDate ?? null,
      probationEndDate: dto.probationEndDate ?? null,
      changeReason: dto.changeReason ?? null,
      status: 'active',
      createdByUserId: actor.id,
    });
    await this.assignments.save(assignment);

    employee.currentAssignmentId = assignment.id;
    employee.departmentId = assignment.departmentId;
    employee.positionId = assignment.positionId;
    await this.employees.save(employee);

    await this.audit.record({
      actorId: actor.id,
      action: 'employee.assignment_changed',
      entityType: 'Employee',
      entityId: id,
      metadata: { assignmentId: assignment.id, changeReason: dto.changeReason },
    });
    return this.getProfile(actor, id);
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
      startDate: a.startDate,
      endDate: a.endDate,
      changeReason: a.changeReason,
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
      workFormat: a.workFormat,
      managerEmployeeId: a.managerEmployeeId,
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
    employee.employmentStatus = dto.status;
    employee.isActive = ![
      'dismissed',
      'archived',
      'suspended',
    ].includes(dto.status);
    employee.archivedAt = employee.isActive ? null : new Date();
    await this.employees.save(employee);
    await this.audit.record({
      actorId: actor.id,
      action: 'employee.status_changed',
      entityType: 'Employee',
      entityId: id,
      metadata: { before, after: dto.status, reason: dto.reason ?? null },
    });
    return this.getProfile(actor, id);
  }

  async history(actor: User, id: string, limit = 50) {
    const employee = await this.access.getEmployeeOrFail(id);
    const caps = await this.capabilities(actor, employee);
    if (!caps.canViewHistory) {
      throw new NotFoundException('Employee not found');
    }
    const rows = await this.auditLogs.find({
      where: { entityType: 'Employee', entityId: id },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorUserId: r.actorUserId,
      createdAt: r.createdAt,
      metadata: this.redactMetadata(r.metadata, caps),
    }));
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
  ) {
    const existing = await this.contacts.findOne({
      where: { employeeId, type },
    });
    if (!value) {
      if (existing) await this.contacts.remove(existing);
      return;
    }
    if (existing) {
      existing.value = value;
      existing.visibility = visibility;
      existing.isPrimary = true;
      await this.contacts.save(existing);
      return;
    }
    await this.contacts.save(
      this.contacts.create({
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
