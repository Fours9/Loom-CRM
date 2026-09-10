import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  contactsBundleFromProfileParts,
  type EmployeeContactsBundle,
  type EmployeeContactsEmergencyItem,
  type EmployeeContactsWorkSlice,
} from '@loom/employee-contacts';
import { AuditService } from '../../platform/audit/audit.service';
import { Employee } from './employee.entity';
import { EmployeeContact } from './employee-contact.entity';
import { EmployeeEmergencyContact } from './employee-emergency-contact.entity';
import {
  PERSONAL_CONTACT_TYPES,
  legacyPersonalFromContacts,
  normalizePersonalContactsForWrite as normalizePersonalWrite,
  type PersonalContactWriteInput,
} from './employee-personal-contacts';

export type EmployeeContactsAuditActor = {
  id: string;
};

export type EmployeeCreateContactsInput = {
  work: EmployeeContactsWorkSlice;
  personal: PersonalContactWriteInput[];
};

@Injectable()
export class EmployeeContactsFacade {
  constructor(private readonly audit: AuditService) {}

  async readContactsBundle(
    manager: EntityManager,
    employeeId: string,
  ): Promise<EmployeeContactsBundle> {
    const employeeRepo = manager.getRepository(Employee);
    const contactRepo = manager.getRepository(EmployeeContact);
    const emergencyRepo = manager.getRepository(EmployeeEmergencyContact);

    const employee = await employeeRepo.findOneByOrFail({ id: employeeId });
    const contacts = await contactRepo.find({
      where: {
        employeeId,
        type: In([...PERSONAL_CONTACT_TYPES]),
      },
      order: { type: 'ASC' },
    });
    const emergency = await emergencyRepo.find({
      where: { employeeId, isActive: true },
      order: { priority: 'ASC' },
    });

    return contactsBundleFromProfileParts({
      workEmail: employee.workEmail,
      workPhone: employee.phoneNumber,
      workTelegram: employee.telegram,
      personalContacts: contacts.map((c) => ({
        type: c.type,
        value: c.value,
        isPrimary: c.isPrimary,
      })),
      emergencyContacts: emergency.map((e) => ({
        fullName: e.fullName,
        relationship: e.relationship,
        primaryPhone: e.primaryPhone,
        secondaryPhone: e.secondaryPhone,
        notes: e.notes,
      })),
    });
  }

  /**
   * Canonical contact rows + legacy mirrors for a newly created Employee.
   * Does not emit update-style audit actions (`contacts_updated` / `personal_contacts_updated`).
   */
  async initializeForCreate(
    manager: EntityManager,
    actor: EmployeeContactsAuditActor,
    employeeId: string,
    input: EmployeeCreateContactsInput,
  ): Promise<void> {
    await this.writeWorkContacts(manager, employeeId, input.work);
    await this.writePersonalContacts(manager, employeeId, input.personal);

    await this.audit.record(
      {
        actorId: actor.id,
        action: 'employee.contacts_initialized',
        entityType: 'Employee',
        entityId: employeeId,
        metadata: {
          work: Boolean(
            input.work.email?.trim() ||
              input.work.phone?.trim() ||
              input.work.telegram?.trim(),
          ),
          personalCount: normalizePersonalWrite(input.personal).length,
        },
      },
      manager,
    );
  }

  async applyWorkContacts(
    manager: EntityManager,
    actor: EmployeeContactsAuditActor,
    employeeId: string,
    work: EmployeeContactsWorkSlice,
  ): Promise<void> {
    await this.writeWorkContacts(manager, employeeId, work);

    await this.audit.record(
      {
        actorId: actor.id,
        action: 'employee.contacts_updated',
        entityType: 'Employee',
        entityId: employeeId,
        metadata: { fields: ['workEmail', 'workPhone', 'workTelegram'] },
      },
      manager,
    );
  }

  async replacePersonalContacts(
    manager: EntityManager,
    actor: EmployeeContactsAuditActor,
    employeeId: string,
    contacts: PersonalContactWriteInput[],
  ): Promise<void> {
    const contactRepo = manager.getRepository(EmployeeContact);
    const previous = await contactRepo.find({
      where: { employeeId, type: In([...PERSONAL_CONTACT_TYPES]) },
    });

    const saved = await this.writePersonalContacts(manager, employeeId, contacts);

    await this.audit.record(
      {
        actorId: actor.id,
        action: 'employee.personal_contacts_updated',
        entityType: 'Employee',
        entityId: employeeId,
        metadata: {
          previousCount: previous.length,
          count: saved.length,
          deletedIds: previous.map((row) => row.id),
          createdIds: saved.map((row) => row.id),
        },
      },
      manager,
    );
  }

  async replaceEmergencyContacts(
    manager: EntityManager,
    actor: EmployeeContactsAuditActor,
    employeeId: string,
    contacts: EmployeeContactsEmergencyItem[],
  ): Promise<void> {
    const employeeRepo = manager.getRepository(Employee);
    const emergencyRepo = manager.getRepository(EmployeeEmergencyContact);

    await employeeRepo.findOneOrFail({
      where: { id: employeeId },
      lock: { mode: 'pessimistic_write' },
    });

    const previous = await emergencyRepo.find({
      where: { employeeId, isActive: true },
    });

    await emergencyRepo.update(
      { employeeId, isActive: true },
      { isActive: false },
    );

    const rows = contacts.map((contact, index) =>
      emergencyRepo.create({
        employeeId,
        fullName: contact.fullName.trim(),
        relationship: contact.relationship.trim() || null,
        primaryPhone: contact.primaryPhone.trim(),
        secondaryPhone: contact.secondaryPhone.trim() || null,
        notes: contact.notes.trim() || null,
        priority: index + 1,
        isActive: true,
      }),
    );
    const saved = rows.length ? await emergencyRepo.save(rows) : [];

    await this.audit.record(
      {
        actorId: actor.id,
        action: 'employee.emergency_updated',
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
  }

  private async writeWorkContacts(
    manager: EntityManager,
    employeeId: string,
    work: EmployeeContactsWorkSlice,
  ): Promise<void> {
    const employeeRepo = manager.getRepository(Employee);
    const row = await employeeRepo.findOneOrFail({
      where: { id: employeeId },
      lock: { mode: 'pessimistic_write' },
    });

    row.workEmail = work.email?.trim() || null;
    row.phoneNumber = work.phone?.trim() || null;
    row.telegram = work.telegram?.trim() || null;
    await employeeRepo.save(row);

    await this.upsertWorkContact(manager, employeeId, 'work_email', row.workEmail);
    await this.upsertWorkContact(manager, employeeId, 'work_phone', row.phoneNumber);
    await this.upsertWorkContact(
      manager,
      employeeId,
      'work_telegram',
      row.telegram,
    );
  }

  private async writePersonalContacts(
    manager: EntityManager,
    employeeId: string,
    contacts: PersonalContactWriteInput[],
  ): Promise<EmployeeContact[]> {
    const normalized = normalizePersonalWrite(contacts);
    const employeeRepo = manager.getRepository(Employee);
    const contactRepo = manager.getRepository(EmployeeContact);

    await employeeRepo.findOneOrFail({
      where: { id: employeeId },
      lock: { mode: 'pessimistic_write' },
    });

    await contactRepo
      .createQueryBuilder()
      .delete()
      .where('employee_id = :employeeId', { employeeId })
      .andWhere('type IN (:...types)', { types: [...PERSONAL_CONTACT_TYPES] })
      .execute();

    const rows = normalized.map((contact) =>
      contactRepo.create({
        employeeId,
        type: contact.type,
        value: contact.value,
        isPrimary: contact.isPrimary,
        visibility: 'personal',
      }),
    );
    const saved = rows.length ? await contactRepo.save(rows) : [];

    const legacy = legacyPersonalFromContacts(saved);
    await employeeRepo.update(employeeId, {
      personalPhoneNumber: legacy.personalPhoneNumber,
      personalEmail: legacy.personalEmail,
      personalTelegram: legacy.personalTelegram,
    });

    return saved;
  }

  private async upsertWorkContact(
    manager: EntityManager,
    employeeId: string,
    type: EmployeeContact['type'],
    value: string | null,
  ): Promise<void> {
    const contacts = manager.getRepository(EmployeeContact);
    const existing = await contacts.findOne({
      where: { employeeId, type },
    });
    if (!value) {
      if (existing) await contacts.remove(existing);
      return;
    }
    if (existing) {
      existing.value = value;
      existing.visibility = 'work';
      existing.isPrimary = true;
      await contacts.save(existing);
      return;
    }
    await contacts.save(
      contacts.create({
        employeeId,
        type,
        value,
        visibility: 'work',
        isPrimary: true,
      }),
    );
  }
}
