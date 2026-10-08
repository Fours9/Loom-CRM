import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UsersService } from '../../platform/identity/users.service';
import { AuditService } from '../../platform/audit/audit.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { OrganizationEmployeeErasureFacade } from '../../organization/employees/organization-employee-erasure.facade';
import { Employee } from '../../organization/employees/employee.entity';
import { AbsencesErasureFacade } from '../../modules/absences/absences-erasure.facade';
import { DocumentsErasureFacade } from '../../modules/documents/documents-erasure.facade';
import { QuestionnairesErasureFacade } from '../../modules/questionnaires/questionnaires-erasure.facade';

/**
 * Hard-delete Employee operational aggregate in one DB transaction.
 * Composition root — does not live in Organization (arrow rule).
 */
@Injectable()
export class EmployeeDeletionCoordinator {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: EmployeeAccessService,
    private readonly orgErase: OrganizationEmployeeErasureFacade,
    private readonly absencesErase: AbsencesErasureFacade,
    private readonly documentsErase: DocumentsErasureFacade,
    private readonly questionnairesErase: QuestionnairesErasureFacade,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  async deleteEmployee(actor: User, employeeId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const snap = await this.orgErase.lockEmployeeForDeletion(
        manager,
        employeeId,
      );

      const lockedTarget = {
        id: snap.id,
        userId: snap.userId,
      } as Employee;

      if (!(await this.access.canDeleteEmployee(actor, lockedTarget))) {
        throw new ForbiddenException();
      }

      await this.absencesErase.eraseForEmployee(manager, snap.id);
      await this.questionnairesErase.eraseForEmployee(manager, snap.id);
      await this.documentsErase.eraseForEmployee(manager, snap.id);
      await this.orgErase.eraseChildrenForEmployee(manager, snap.id);

      if (snap.userId) {
        await this.users.deleteById(snap.userId, manager);
      }

      await this.orgErase.deleteEmployeeRow(manager, snap.id);

      await this.audit.record(
        {
          actorId: actor.id,
          action: 'employee.deleted',
          entityType: 'employee',
          entityId: snap.id,
          metadata: { employeeNumber: snap.employeeNumber },
        },
        manager,
      );
    });
  }
}
