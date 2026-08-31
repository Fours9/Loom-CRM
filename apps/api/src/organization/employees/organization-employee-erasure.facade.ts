import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Employee } from './employee.entity';
import { EmployeeContact } from './employee-contact.entity';
import { EmployeeEmergencyContact } from './employee-emergency-contact.entity';
import { EmployeeImportantDate } from './employee-important-date.entity';
import { EmployeeManagedDepartment } from './employee-managed-department.entity';
import { EmploymentAssignment } from './employment-assignment.entity';
import { WorkScheduleDay } from './work-schedule-day.entity';
import { EmployeeSkillAssessment } from '../skills/employee-skill-assessment.entity';

export type LockedEmployeeForDeletion = {
  id: string;
  userId: string | null;
  employeeNumber: string;
};

/**
 * Organization-owned children for Employee hard-delete + lock / row delete.
 * Does not delete User or the Employee row itself (except {@link deleteEmployeeRow}).
 */
@Injectable()
export class OrganizationEmployeeErasureFacade {
  async lockEmployeeForDeletion(
    manager: EntityManager,
    employeeId: string,
  ): Promise<LockedEmployeeForDeletion> {
    const row = await manager
      .getRepository(Employee)
      .createQueryBuilder('e')
      .setLock('pessimistic_write')
      .where('e.id = :employeeId', { employeeId })
      .getOne();
    if (!row) throw new NotFoundException('Employee not found');
    return {
      id: row.id,
      userId: row.userId ?? null,
      employeeNumber: row.employeeNumber,
    };
  }

  async eraseChildrenForEmployee(
    manager: EntityManager,
    employeeId: string,
  ): Promise<void> {
    await manager
      .getRepository(WorkScheduleDay)
      .delete({ employeeId });
    await manager
      .getRepository(EmployeeManagedDepartment)
      .delete({ employeeId });
    await manager.getRepository(EmployeeContact).delete({ employeeId });
    await manager
      .getRepository(EmployeeEmergencyContact)
      .delete({ employeeId });
    await manager
      .getRepository(EmployeeImportantDate)
      .delete({ employeeId });
    await manager
      .getRepository(EmployeeSkillAssessment)
      .delete({ employeeId });

    const assignments = manager.getRepository(EmploymentAssignment);
    await assignments
      .createQueryBuilder()
      .update(EmploymentAssignment)
      .set({ managerEmployeeId: null })
      .where('manager_employee_id = :employeeId', { employeeId })
      .execute();
    await assignments
      .createQueryBuilder()
      .update(EmploymentAssignment)
      .set({ mentorEmployeeId: null })
      .where('mentor_employee_id = :employeeId', { employeeId })
      .execute();
    await assignments
      .createQueryBuilder()
      .update(EmploymentAssignment)
      .set({ hrResponsibleEmployeeId: null })
      .where('hr_responsible_employee_id = :employeeId', { employeeId })
      .execute();

    await assignments.delete({ employeeId });
  }

  async deleteEmployeeRow(
    manager: EntityManager,
    employeeId: string,
  ): Promise<void> {
    await manager.getRepository(Employee).delete({ id: employeeId });
  }
}
